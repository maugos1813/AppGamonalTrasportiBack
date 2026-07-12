import { z } from "zod";

const AREA_VALUES = ["EXTRAS_PIAZZA", "DHL", "FARMACIA"];
const GRUPO_VALUES = ["SOCIEDAD", "MILANO_NORD", "MILANO_SUD", "ROMA", "FARMACIA"];
const ESTADO_VEHICULO_VALUES = ["DISPONIBLE", "EN_MANTENIMIENTO", "FUERA_DE_SERVICIO"];

const targaSchema = z
  .string()
  .trim()
  .min(1, "La targa es obligatoria")
  .transform((value) => value.toUpperCase());

export const createVehicleSchema = z.object({
  targa: targaSchema,
  modelo: z.string().trim().min(1, "El modelo es obligatorio"),
  area: z.enum(AREA_VALUES, { errorMap: () => ({ message: "Area invalida" }) }),
  grupo: z.enum(GRUPO_VALUES, { errorMap: () => ({ message: "Grupo invalido" }) }).optional(),
  estado: z.enum(ESTADO_VEHICULO_VALUES).optional(),
  poliza: z.coerce.date().optional(),
  rTecnica: z.coerce.date().optional(),
});

export const updateVehicleSchema = z.object({
  targa: targaSchema.optional(),
  modelo: z.string().trim().min(1).optional(),
  area: z.enum(AREA_VALUES).optional(),
  grupo: z.enum(GRUPO_VALUES).optional(),
  estado: z.enum(ESTADO_VEHICULO_VALUES).optional(),
  poliza: z.coerce.date().optional(),
  rTecnica: z.coerce.date().optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Id invalido"),
});
