import { z } from "zod";

const AREA_VALUES = ["EXTRAS_PIAZZA", "DHL", "FARMACIA"];
const GRUPO_VALUES = ["SOCIEDAD", "MILANO_NORD", "MILANO_SUD", "ROMA", "FARMACIA"];
const ESTADO_VEHICULO_VALUES = ["DISPONIBLE", "EN_MANTENIMIENTO", "FUERA_DE_SERVICIO"];

const targaSchema = z
  .string()
  .trim()
  .min(1, "La targa es obligatoria")
  .transform((value) => value.toUpperCase());

// Estos campos llegan via multipart/form-data (multer), donde todo es string - a
// diferencia de z.coerce.boolean() (que trata cualquier string no vacio, incluido
// "false", como true), esto interpreta el string tal cual.
const booleanFromFormSchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

export const createVehicleSchema = z.object({
  targa: targaSchema,
  modelo: z.string().trim().min(1, "El modelo es obligatorio"),
  area: z.enum(AREA_VALUES, { errorMap: () => ({ message: "Area invalida" }) }),
  grupo: z.enum(GRUPO_VALUES, { errorMap: () => ({ message: "Grupo invalido" }) }).optional(),
  estado: z.enum(ESTADO_VEHICULO_VALUES).optional(),
  poliza: z.coerce.date().optional(),
  rTecnica: z.coerce.date().optional(),
  kmUltimoMantenimiento: z.coerce.number().nonnegative().optional(),
  kmActual: z.coerce.number().nonnegative().optional(),
  autorizadoAreaC: booleanFromFormSchema.optional(),
});

export const updateVehicleSchema = z.object({
  targa: targaSchema.optional(),
  modelo: z.string().trim().min(1).optional(),
  area: z.enum(AREA_VALUES).optional(),
  grupo: z.enum(GRUPO_VALUES).optional(),
  estado: z.enum(ESTADO_VEHICULO_VALUES).optional(),
  poliza: z.coerce.date().optional(),
  rTecnica: z.coerce.date().optional(),
  kmUltimoMantenimiento: z.coerce.number().nonnegative().optional(),
  kmActual: z.coerce.number().nonnegative().optional(),
  autorizadoAreaC: booleanFromFormSchema.optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Id invalido"),
});

export const mantenimientoIdParamSchema = z.object({
  id: z.string().uuid("Id invalido"),
  mantenimientoId: z.string().uuid("Id invalido"),
});

// ETA a un destino escrito a mano (Mapa) - origenLat/Lng vienen del propio front (la
// posicion que ya esta mostrando en el marcador, sea del GPS del vehiculo o del
// celular del chofer), no se vuelve a resolver del lado del backend.
export const etaToDestinationSchema = z.object({
  origenLat: z.coerce.number().min(-90).max(90),
  origenLng: z.coerce.number().min(-180).max(180),
  destino: z.string().trim().min(1, "El destino es obligatorio"),
});

// Seccion "Area C" del Mapa - pagado siempre obligatorio (no ".optional()"): el
// checkbox del formulario del front siempre manda un valor concreto en cada submit, y
// del lado del service data.pagado decide tambien si se pisa paidAt - un
// "undefined" ahi lo pondria en null por error.
export const updateAreaCEntrySchema = z.object({
  pagado: booleanFromFormSchema,
});

export const registerKmSchema = z
  .object({
    kmUltimoMantenimiento: z.coerce.number().nonnegative().optional(),
    kmActual: z.coerce.number().nonnegative().optional(),
  })
  .refine((data) => data.kmUltimoMantenimiento !== undefined || data.kmActual !== undefined, {
    message: "Cargar al menos un valor de KM",
  });
