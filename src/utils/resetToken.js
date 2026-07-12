import crypto from "node:crypto";

// El token en texto plano se envia por email y nunca se guarda en la DB;
// solo se persiste su hash para poder validarlo sin exponerlo si la DB se filtra.
export const generateResetToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashResetToken(rawToken);
  return { rawToken, hashedToken };
};

export const hashResetToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");
