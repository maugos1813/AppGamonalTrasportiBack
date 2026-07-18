import { z } from "zod";

const RECORD_STATUS_VALUES = [
  "CONSEGNATO",
  "IN_CONSEGNA",
  "IN_SOSPESO",
  "RITIRATO",
  "ANNULLATO",
  "RISCHEDULATO",
];

const APLICATIVO_VALUES = Array.from({ length: 18 }, (_, i) => `MILANO_${i + 1}`);
const SPEDIZZIONE_VALUES = ["DHL", "AB_SERVICE", "EXTRA_PIAZZA"];

const economicFields = {
  kilometros: z.coerce.number().optional(),
  precioKm: z.coerce.number().optional(),
  areaC: z.coerce.number().optional(),
  costoEspera: z.coerce.number().optional(),
  costoTraforoFrejusBrennero: z.coerce.number().optional(),
  peajes: z.coerce.number().optional(),
  vignetta: z.coerce.number().optional(),
  costoHotel: z.coerce.number().optional(),
  pagoRecibido: z.coerce.number().optional(),
  costoCombustible: z.coerce.number().optional(),
  clienteConfirmado: z.coerce.boolean().optional(),
};

// Campos operativos: los unicos que un CHOFER puede tocar en su propio record
// (el filtrado real por rol pasa en record.service.js, esto solo valida tipos).
const operationalFields = {
  estado: z.enum(RECORD_STATUS_VALUES, { errorMap: () => ({ message: "Estado invalido" }) }).optional(),
  horasDia: z.coerce.number().optional(),
  horasNoche: z.coerce.number().optional(),
  tiempoEspera: z.coerce.number().optional(),
  comentarios: z.string().trim().optional(),
  kilometrosReales: z.coerce.number().optional(),
};

// Paradas del servicio, en orden. El deposito de partida es fijo (no se envia desde el
// cliente) y "destinazione" se deriva en el backend a partir de la ultima parada.
const stopsField = z
  .array(z.string().trim().min(1, "La direccion de la parada no puede estar vacia"))
  .min(1, "Debe haber al menos una parada")
  .max(10, "Maximo 10 paradas");

export const createRecordSchema = z.object({
  driverId: z.string().uuid("driverId invalido"),
  vehicleId: z.string().uuid("vehicleId invalido"),
  clientId: z.string().uuid("clientId invalido"),
  fechaServicio: z.coerce.date({ errorMap: () => ({ message: "fechaServicio invalida" }) }),
  eta: z.coerce.date({ errorMap: () => ({ message: "eta invalida" }) }),
  descripcion: z.string().trim().min(1, "La descripcion es obligatoria"),
  codigo: z.string().trim().min(1, "El codigo es obligatorio"),
  ciudad: z.string().trim().optional(),
  aplicativo: z.enum(APLICATIVO_VALUES, { errorMap: () => ({ message: "Aplicativo invalido" }) }).optional(),
  spedizzione: z.enum(SPEDIZZIONE_VALUES, { errorMap: () => ({ message: "Spedizzione invalida" }) }).optional(),
  origenExternoId: z.string().trim().min(1).optional(),
  stops: stopsField,
  ...operationalFields,
  ...economicFields,
});

export const updateRecordSchema = z.object({
  driverId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  fechaServicio: z.coerce.date().optional(),
  eta: z.coerce.date().optional(),
  descripcion: z.string().trim().min(1).optional(),
  codigo: z.string().trim().min(1).optional(),
  ciudad: z.string().trim().optional(),
  aplicativo: z.enum(APLICATIVO_VALUES).optional(),
  spedizzione: z.enum(SPEDIZZIONE_VALUES).optional(),
  stops: stopsField.optional(),
  ...operationalFields,
  ...economicFields,
});

export const idParamSchema = z.object({
  id: z.string().uuid("Id invalido"),
});

export const yearParamSchema = z.object({
  year: z.coerce.number().int().min(1970).max(3000),
});

export const yearMonthParamSchema = yearParamSchema.extend({
  month: z.coerce.number().int().min(1).max(12),
});

export const yearMonthDayParamSchema = yearMonthParamSchema.extend({
  day: z.coerce.number().int().min(1).max(31),
});
