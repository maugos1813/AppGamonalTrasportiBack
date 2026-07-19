import { randomUUID } from "node:crypto";
import {
  createUser as createUserRecord,
  deleteUserById,
  findAllUsers,
  findUserById,
  findUserLocationById,
  findUsersWithFreshLocation,
  updateUserById,
  updateUserLocation,
  updateUserLocationPermission,
} from "../models/user.model.js";
import { findActiveRecordsByDriverIds } from "../models/record.model.js";
import { DEPOT_ORIGIN } from "../constants/depot.js";
import { calculateRoute } from "./routing.service.js";
import { purgeDocumentsForUser } from "./document.service.js";
import { deleteObject, getSignedUrlForKey, uploadObject } from "./storage.service.js";
import { compressAvatar } from "../utils/imageProcessor.js";
import { AppError } from "../utils/AppError.js";
import { hashPassword } from "../utils/password.js";

// Solo un OWNER puede crear o ascender a otro usuario a OWNER; evita que un ADMIN se autoascienda.
const assertCanAssignCargo = (actor, cargo) => {
  if (cargo === "OWNER" && actor.cargo !== "OWNER") {
    throw new AppError("Solo un OWNER puede asignar el cargo OWNER", 403);
  }
};

// Campos que un CHOFER puede modificar sobre si mismo; cargo/area/estado quedan fuera
// para que no pueda autoasignarse privilegios ni reactivarse si fue desactivado.
const SELF_EDITABLE_FIELDS = [
  "nombre",
  "apellido",
  "numeroCelular",
  "password",
  "compartirUbicacion",
];

// El bucket es privado: nunca se expone la key interna, siempre una URL firmada fresca.
export const toUserResponse = async (user) => {
  const { imagenPerfilKey, ...rest } = user;
  return {
    ...rest,
    imagenUrl: imagenPerfilKey ? await getSignedUrlForKey(imagenPerfilKey) : null,
  };
};

export const listUsers = async () => {
  const users = await findAllUsers();
  return Promise.all(users.map(toUserResponse));
};

export const getUserById = async (id) => {
  const user = await findUserById(id);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }
  return toUserResponse(user);
};

export const createUser = async (actor, data) => {
  assertCanAssignCargo(actor, data.cargo);

  const hashedPassword = await hashPassword(data.password);

  const user = await createUserRecord({
    ...data,
    estado: data.estado ?? "ACTIVO",
    password: hashedPassword,
  });
  return toUserResponse(user);
};

export const updateUser = async (actor, targetId, data) => {
  const isSelf = actor.id === targetId;
  const isPrivileged = actor.cargo === "OWNER" || actor.cargo === "ADMIN";

  let payload = data;

  if (isSelf && !isPrivileged) {
    payload = Object.fromEntries(
      Object.entries(data).filter(([key]) => SELF_EDITABLE_FIELDS.includes(key))
    );
  }

  if (payload.cargo) {
    assertCanAssignCargo(actor, payload.cargo);
  }

  if (payload.password) {
    payload = { ...payload, password: await hashPassword(payload.password) };
  }

  const user = await findUserById(targetId);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const updated = await updateUserById(targetId, payload);
  return toUserResponse(updated);
};

export const uploadUserAvatar = async (targetId, file) => {
  const user = await findUserById(targetId);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const buffer = await compressAvatar(file.buffer);
  const key = `avatars/${targetId}/avatar-${Date.now()}-${randomUUID()}.webp`;
  await uploadObject(key, buffer, "image/webp");

  if (user.imagenPerfilKey) {
    await deleteObject(user.imagenPerfilKey);
  }

  const updated = await updateUserById(targetId, { imagenPerfilKey: key });
  return toUserResponse(updated);
};

export const LOCATION_FRESH_MINUTES = 5;

export const updateMyLocation = (actorId, { lat, lng }) => updateUserLocation(actorId, lat, lng);

export const updateMyLocationPermission = (actorId, denegado) =>
  updateUserLocationPermission(actorId, denegado);

// Se exponen todos los choferes con ubicacion reciente, tengan o no un servicio en
// camino ahora mismo: el chofer comparte ubicacion durante todo su horario laboral
// (ver useLocationSharing en el frontend), no solo mientras reparte, asi que tambien
// se lo ve "libre" volviendo de una entrega o esperando el proximo servicio - util
// para mandarle el siguiente pedido al que este mas cerca. Un chofer puede tener MAS
// DE UN servicio "en camino" a la vez (un OWNER/ADMIN puede compactar varias entregas
// en un mismo viaje), asi que se devuelve una entrada por cada servicio activo -no una
// sola por chofer-, todas con la misma posicion GPS. Solo son posiciones: NO calcula
// ninguna ruta/ETA aca (eso saldria caro corriendolo cada 20s para todos los choferes
// aunque nadie los este mirando) - el ETA en vivo de un servicio o el regreso al
// deposito de un chofer libre se piden aparte, a demanda, solo para lo que el OWNER/
// ADMIN tiene abierto en el mapa (ver getLiveEtaForRecord en record.service.js y
// getReturnEtaForDriver mas abajo).
export const listActiveDriverLocations = async () => {
  const since = new Date(Date.now() - LOCATION_FRESH_MINUTES * 60 * 1000);
  const users = await findUsersWithFreshLocation(since);
  if (users.length === 0) return [];

  const activeRecords = await findActiveRecordsByDriverIds(users.map((u) => u.id));
  const recordsByDriverId = activeRecords.reduce((acc, record) => {
    (acc[record.driverId] ??= []).push(record);
    return acc;
  }, {});

  return users.flatMap((u) => {
    const records = recordsByDriverId[u.id];
    const base = {
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      lat: u.ubicacionLat,
      lng: u.ubicacionLng,
      actualizada: u.ubicacionActualizada,
    };

    if (!records?.length) {
      return [{ ...base, servicio: null }];
    }
    return records.map(({ stops, ...servicio }) => ({ ...base, servicio }));
  });
};

// Ruta en vivo desde la posicion GPS actual del chofer de vuelta al deposito (Via
// Walter Tobagi, 8), a demanda: solo se llama cuando el OWNER/ADMIN abre en el mapa el
// marcador de un chofer libre. Best-effort, igual que calculateRoute: si falla o la
// ubicacion no esta fresca, se devuelve null y el mapa muestra "no disponible".
export const getReturnEtaForDriver = async (driverId) => {
  const user = await findUserLocationById(driverId);
  if (!user || user.ubicacionLat == null || user.ubicacionLng == null) return null;

  const staleSince = new Date(Date.now() - LOCATION_FRESH_MINUTES * 60 * 1000);
  if (!user.ubicacionActualizada || user.ubicacionActualizada < staleSince) return null;

  const ruta = await calculateRoute([
    { lat: user.ubicacionLat, lng: user.ubicacionLng },
    { lat: DEPOT_ORIGIN.lat, lng: DEPOT_ORIGIN.lng },
  ]);
  if (!ruta) return null;

  return { distanciaKm: ruta.distanciaKm, duracionMin: ruta.duracionMin, geometria: ruta.geometria };
};

export const deleteUser = async (actor, targetId) => {
  if (actor.id === targetId) {
    throw new AppError("No puedes eliminar tu propia cuenta", 400);
  }

  const user = await findUserById(targetId);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  // Se borran los objetos de R2 antes de la fila: el ON DELETE CASCADE limpia la tabla
  // documentos automaticamente, pero no sabe nada de R2, y dejaria archivos huerfanos en el bucket.
  await purgeDocumentsForUser(targetId);
  if (user.imagenPerfilKey) {
    await deleteObject(user.imagenPerfilKey);
  }

  await deleteUserById(targetId);
};
