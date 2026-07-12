import { z } from "zod";

const AREA_VALUES = ["EXTRAS_PIAZZA", "DHL", "FARMACIA"];
const CARGO_VALUES = ["OWNER", "ADMIN", "CHOFER"];
const ESTADO_VALUES = ["ACTIVO", "INACTIVO"];

const passwordSchema = z
  .string()
  .min(8, "La contrasena debe tener al menos 8 caracteres");

export const createUserSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  apellido: z.string().trim().min(1, "El apellido es obligatorio"),
  area: z.enum(AREA_VALUES, { errorMap: () => ({ message: "Area invalida" }) }),
  cargo: z.enum(CARGO_VALUES, { errorMap: () => ({ message: "Cargo invalido" }) }),
  estado: z.enum(ESTADO_VALUES).optional(),
  fechaNacimiento: z.coerce.date({ errorMap: () => ({ message: "Fecha de nacimiento invalida" }) }),
  numeroCelular: z.string().trim().min(6, "Numero de celular invalido"),
  correoElectronico: z.string().trim().email("Correo electronico invalido"),
  password: passwordSchema,
});

export const updateUserSchema = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    apellido: z.string().trim().min(1).optional(),
    area: z.enum(AREA_VALUES).optional(),
    cargo: z.enum(CARGO_VALUES).optional(),
    estado: z.enum(ESTADO_VALUES).optional(),
    fechaNacimiento: z.coerce.date().optional(),
    numeroCelular: z.string().trim().min(6).optional(),
    correoElectronico: z.string().trim().email().optional(),
    password: passwordSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const idParamSchema = z.object({
  id: z.string().uuid("Id invalido"),
});
