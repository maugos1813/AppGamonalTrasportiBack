import { verifyToken } from "../utils/jwt.js";
import { findUserById } from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("No autenticado: token no proporcionado", 401);
  }

  const token = authHeader.slice("Bearer ".length);

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError("No autenticado: token invalido o expirado", 401);
  }

  // Se vuelve a leer el usuario en cada request (en vez de confiar solo en el payload)
  // para que un usuario desactivado pierda el acceso de inmediato, sin esperar a que expire el token.
  const user = await findUserById(payload.sub);

  if (!user) {
    throw new AppError("No autenticado: el usuario ya no existe", 401);
  }

  if (user.estado === "INACTIVO") {
    throw new AppError("Tu cuenta esta inactiva. Contacta a un administrador.", 403);
  }

  req.user = user;
  next();
});
