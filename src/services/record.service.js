import {
  createRecord as createRecordModel,
  deleteRecordById,
  findRecordById,
  findRecords,
  updateRecordById,
} from "../models/record.model.js";
import { findUserById } from "../models/user.model.js";
import { purgeFilesForRecord } from "./recordFile.service.js";
import { AppError } from "../utils/AppError.js";

const isPrivileged = (actor) => actor.cargo === "OWNER" || actor.cargo === "ADMIN";

const assertAccess = (actor, record) => {
  if (isPrivileged(actor) || record.driverId === actor.id) return;
  throw new AppError("No tienes permisos para realizar esta accion", 403);
};

const assertDriverActivo = async (driverId) => {
  const driver = await findUserById(driverId);
  if (!driver || driver.estado !== "ACTIVO") {
    throw new AppError("El conductor indicado no existe o esta inactivo", 400);
  }
};

// Campos operativos que un CHOFER puede editar en su propio record; el resto (economico,
// relaciones, etc.) se ignora si viene de un CHOFER, igual que SELF_EDITABLE_FIELDS en user.service.js.
const SELF_EDITABLE_FIELDS = [
  "horasDia",
  "horasNoche",
  "tiempoEspera",
  "estado",
  "comentarios",
  "kilometrosReales",
];

const computeTotals = (record) => {
  const kilometros = record.kilometros ?? 0;
  const precioKm = record.precioKm ?? 0;
  const totalKm = kilometros * precioKm;

  // costoCombustible y pagoRecibido quedan fuera del total a proposito.
  const total =
    totalKm +
    (record.areaC ?? 0) +
    (record.costoEspera ?? 0) +
    (record.costoTraforoFrejusBrennero ?? 0) +
    (record.peajes ?? 0) +
    (record.vignetta ?? 0) +
    (record.costoHotel ?? 0);

  return { totalKm, total };
};

// Diferencia entre lo que reporto el chofer y lo que se planifico, para que
// OWNER/ADMIN puedan detectar desvios. null si todavia no hay dato real cargado.
const computeKmDiff = (record) =>
  record.kilometrosReales != null && record.kilometros != null
    ? record.kilometrosReales - record.kilometros
    : null;

const toFullResponse = (record) => {
  const { totalKm, total } = computeTotals(record);
  return {
    id: record.id,
    estado: record.estado,
    driver: record.driver,
    vehicle: record.vehicle,
    client: record.client,
    fechaServicio: record.fechaServicio,
    eta: record.eta,
    descripcion: record.descripcion,
    codigo: record.codigo,
    destinazione: record.destinazione,
    horasDia: record.horasDia,
    horasNoche: record.horasNoche,
    tiempoEspera: record.tiempoEspera,
    comentarios: record.comentarios,
    kilometros: record.kilometros,
    kilometrosReales: record.kilometrosReales,
    diferenciaKm: computeKmDiff(record),
    precioKm: record.precioKm,
    totalKm,
    areaC: record.areaC,
    costoEspera: record.costoEspera,
    costoTraforoFrejusBrennero: record.costoTraforoFrejusBrennero,
    peajes: record.peajes,
    vignetta: record.vignetta,
    costoHotel: record.costoHotel,
    pagoRecibido: record.pagoRecibido,
    costoCombustible: record.costoCombustible,
    clienteConfirmado: record.clienteConfirmado,
    total,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

// Vista para CHOFER: sin campos economicos, salvo "kilometros" (solo lectura, lo que se
// planifico) y "kilometrosReales" (lo que el propio chofer carga) para que pueda compararlos.
const toChoferResponse = (record) => ({
  id: record.id,
  estado: record.estado,
  driver: record.driver,
  vehicle: record.vehicle,
  client: record.client,
  fechaServicio: record.fechaServicio,
  eta: record.eta,
  descripcion: record.descripcion,
  codigo: record.codigo,
  destinazione: record.destinazione,
  horasDia: record.horasDia,
  horasNoche: record.horasNoche,
  tiempoEspera: record.tiempoEspera,
  comentarios: record.comentarios,
  kilometros: record.kilometros,
  kilometrosReales: record.kilometrosReales,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const toResponse = (record, actor) => (isPrivileged(actor) ? toFullResponse(record) : toChoferResponse(record));

export const createRecord = async (data) => {
  await assertDriverActivo(data.driverId);

  const record = await createRecordModel({
    ...data,
    estado: data.estado ?? "IN_SOSPESO",
    clienteConfirmado: data.clienteConfirmado ?? false,
  });

  return toFullResponse(record);
};

export const listRecordsForActor = async (actor, dateRange) => {
  const driverId = isPrivileged(actor) ? undefined : actor.id;
  const records = await findRecords({ driverId, dateRange });
  return records.map((record) => toResponse(record, actor));
};

export const getRecordByIdForActor = async (actor, id) => {
  const record = await findRecordById(id);
  if (!record) {
    throw new AppError("Registro no encontrado", 404);
  }
  assertAccess(actor, record);
  return toResponse(record, actor);
};

export const updateRecordForActor = async (actor, id, data) => {
  const record = await findRecordById(id);
  if (!record) {
    throw new AppError("Registro no encontrado", 404);
  }
  assertAccess(actor, record);

  let payload = data;

  if (isPrivileged(actor)) {
    if (payload.driverId) {
      await assertDriverActivo(payload.driverId);
    }
  } else {
    payload = Object.fromEntries(
      Object.entries(data).filter(([key]) => SELF_EDITABLE_FIELDS.includes(key))
    );
  }

  const updated = await updateRecordById(id, payload);
  return toResponse(updated, actor);
};

export const deleteRecord = async (id) => {
  const record = await findRecordById(id);
  if (!record) {
    throw new AppError("Registro no encontrado", 404);
  }

  await purgeFilesForRecord(id);
  await deleteRecordById(id);
};
