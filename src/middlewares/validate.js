import { AppError } from "../utils/AppError.js";

// source: "body" | "params" | "query"
export const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const details = result.error.flatten().fieldErrors;
    return next(new AppError("Datos invalidos", 400, details));
  }

  req[source] = result.data;
  next();
};
