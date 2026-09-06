import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatorio"),

  JWT_SECRET: z.string().min(16, "JWT_SECRET debe tener al menos 16 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  RESET_TOKEN_EXPIRES_MINUTES: z.coerce.number().default(30),
  RESET_PASSWORD_URL: z.string().url(),

  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY es obligatorio"),
  RESEND_FROM_EMAIL: z.string().min(1, "RESEND_FROM_EMAIL es obligatorio"),

  R2_ACCOUNT_ID: z.string().min(1, "R2_ACCOUNT_ID es obligatorio"),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2_ACCESS_KEY_ID es obligatorio"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2_SECRET_ACCESS_KEY es obligatorio"),
  R2_BUCKET_NAME: z.string().min(1, "R2_BUCKET_NAME es obligatorio"),
  R2_SIGNED_URL_EXPIRES_SECONDS: z.coerce.number().default(900),

  // Reemplaza a Nominatim (bloqueaba/limitaba por IP compartida en Render). Se pide
  // en Google Cloud Console > APIs & Services, habilitando "Geocoding API".
  GOOGLE_MAPS_API_KEY: z.string().min(1, "GOOGLE_MAPS_API_KEY es obligatorio"),
  OSRM_BASE_URL: z.string().url().default("https://router.project-osrm.org"),

  // GPS de vehiculo (seccion Mapa) - Refresh Token de la cuenta de Velocity Fleet, ver
  // https://api-docs.velocityfleet.com/authentication. Opcional a proposito: sin esto
  // el Mapa sigue andando igual, solo que con la ubicacion del celular del chofer en
  // vez de la del GPS del vehiculo (ver velocityFleet.service.js).
  VELOCITY_FLEET_REFRESH_TOKEN: z.string().optional(),

  // Dias de historial de LocationPing (recorrido GPS del celular del chofer, ver
  // "Ruta chofer"/"Recorrido real (GPS)") que se conservan antes de poder borrarlos con
  // /api/users/location-pings/cleanup - medida de optimizacion de costos (storage de
  // Neon), ver ese endpoint en user.controller.js.
  LOCATION_PING_RETENTION_DAYS: z.coerce.number().default(90),

  // Dias que se conserva un AreaCEntry SIN PAGAR (alerta de vehiculo sin autorizacion
  // dentro del Area C, ver vehicle.service.js) antes de poder borrarlo con
  // /api/vehiculos/area-c-entries/cleanup. Default chico (3 dias) a proposito: en
  // Milano se paga el Area C el mismo dia o el siguiente, pasado eso el dato ya no
  // sirve para nada. Una vez marcada pagada, la entrada NUNCA se borra sola (queda
  // como comprobante, igual que cualquier otro documento de la app).
  AREA_C_ENTRY_RETENTION_DAYS: z.coerce.number().default(3),

  // Exceso de velocidad (GPS del vehiculo, campanita de notificaciones) - umbral en
  // km/h (ver vehicle.service.js) y minutos para agrupar un exceso sostenido como el
  // mismo episodio en vez de una fila nueva cada 30-60s.
  SPEEDING_THRESHOLD_KMH: z.coerce.number().default(120),
  SPEEDING_DEDUP_MINUTES: z.coerce.number().default(20),
  // Dias que se conserva un SpeedingEvent antes de poder borrarlo con
  // /api/vehiculos/speeding-events/cleanup - a diferencia de AreaCEntry, esto no tiene
  // "pagado": es un aviso de manejo que se descarta con la X normal de la campanita,
  // asi que se poda entero pasado este plazo, sin excepciones.
  SPEEDING_EVENT_RETENTION_DAYS: z.coerce.number().default(30),

  // Notificaciones push al celular (Area C sin autorizacion, exceso de velocidad) via
  // Firebase Cloud Messaging - opcional a proposito: sin esto la app sigue funcionando
  // igual (la campanita web sigue mostrando las mismas alertas), solo que sin avisar
  // tambien al celular con la app cerrada. Se pega el JSON completo de la cuenta de
  // servicio en una sola linea (Firebase Console > Configuracion del proyecto >
  // Cuentas de servicio > Generar nueva clave privada), ver README.
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables de entorno invalidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
