import { AppError } from "../utils/AppError.js";

// Permite el acceso solo a los cargos indicados (ej: authorize("OWNER", "ADMIN")).
export const authorize = (...allowedCargos) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError("No autenticado", 401));
  }

  if (!allowedCargos.includes(req.user.cargo)) {
    return next(new AppError("No tienes permisos para realizar esta accion", 403));
  }

  next();
};

// Permite el acceso si el usuario tiene uno de los cargos indicados,
// o si el recurso solicitado (req.params.id) le pertenece a el mismo.
export const authorizeSelfOrRoles = (...allowedCargos) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError("No autenticado", 401));
  }

  const isSelf = req.params.id === req.user.id;
  const hasRole = allowedCargos.includes(req.user.cargo);

  if (!isSelf && !hasRole) {
    return next(new AppError("No tienes permisos para realizar esta accion", 403));
  }

  next();
};
