import { cert, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../config/env.js";
import { deletePushTokensByToken, findPushTokensForUserIds } from "../models/pushToken.model.js";

// Lazy init, igual que Velocity Fleet: sin FIREBASE_SERVICE_ACCOUNT_JSON configurado
// las notificaciones push quedan deshabilitadas sin romper nada (la campanita web
// sigue funcionando igual, solo que sin avisar tambien al celular con la app cerrada).
let firebaseApp;
let initAttempted = false;

const getFirebaseApp = () => {
  if (initAttempted) return firebaseApp;
  initAttempted = true;
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) return null;
  try {
    const credentials = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    firebaseApp = initializeApp({ credential: cert(credentials) });
  } catch (err) {
    console.error(
      "No se pudo inicializar Firebase Admin (revisar FIREBASE_SERVICE_ACCOUNT_JSON):",
      err.message
    );
    firebaseApp = null;
  }
  return firebaseApp;
};

const isUnregisteredError = (error) =>
  error?.code === "messaging/registration-token-not-registered" ||
  error?.code === "messaging/invalid-registration-token" ||
  error?.code === "messaging/invalid-argument";

// Best-effort: se llama desde deteccion en vivo (checkAreaCEntries/checkSpeedingEvents
// en vehicle.service.js), nunca debe romper esa respuesta. Si Firebase no esta
// configurado, o el usuario no tiene ningun dispositivo registrado, no hace nada.
export const sendPushToUserIds = async (userIds, { title, body, data } = {}) => {
  if (!userIds?.length) return;
  const app = getFirebaseApp();
  if (!app) return;

  const tokens = await findPushTokensForUserIds(userIds);
  if (!tokens.length) return;

  const response = await getMessaging(app).sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [k, String(v)])),
    android: { priority: "high" },
  });

  const invalidTokens = response.responses
    .map((r, i) => (!r.success && isUnregisteredError(r.error) ? tokens[i].token : null))
    .filter(Boolean);
  if (invalidTokens.length) await deletePushTokensByToken(invalidTokens);
};
