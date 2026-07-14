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

  NOMINATIM_BASE_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
  NOMINATIM_USER_AGENT: z.string().min(1).default("GamonalTrasporti/1.0 (maufabagosgam@gmail.com)"),
  OSRM_BASE_URL: z.string().url().default("https://router.project-osrm.org"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables de entorno invalidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
