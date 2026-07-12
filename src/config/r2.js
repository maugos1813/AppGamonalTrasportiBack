import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

// Cloudflare R2 expone una API compatible con S3 en este endpoint por cuenta.
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});
