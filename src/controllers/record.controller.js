import {
  createRecord,
  deleteRecord,
  getLiveEtaForRecord,
  getRecordByIdForActor,
  listPendingRecordsForActor,
  listRecordsForActor,
  listRecordsSummaryForActor,
  searchRecordsForActor,
  updateRecordForActor,
} from "../services/record.service.js";
import { buildDateRange } from "../utils/dateRange.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const create = asyncHandler(async (req, res) => {
  const record = await createRecord(req.body);
  res.status(201).json({ success: true, data: { record } });
});

export const list = asyncHandler(async (req, res) => {
  const records = await listRecordsForActor(req.user);
  res.status(200).json({ success: true, data: { records } });
});

// Panel de "Pendientes" de Registros: acotado a +/-3 dias, no el historico completo.
export const listPending = asyncHandler(async (req, res) => {
  const records = await listPendingRecordsForActor(req.user);
  res.status(200).json({ success: true, data: { records } });
});

// Buscador de Registros (codigo/cliente/chofer/destino), con limite de resultados.
export const search = asyncHandler(async (req, res) => {
  const records = await searchRecordsForActor(req.user, req.query.q);
  res.status(200).json({ success: true, data: { records } });
});

export const listByYear = asyncHandler(async (req, res) => {
  const dateRange = buildDateRange(req.params.year);
  const records = await listRecordsForActor(req.user, dateRange);
  res.status(200).json({ success: true, data: { records } });
});

export const listByMonth = asyncHandler(async (req, res) => {
  const dateRange = buildDateRange(req.params.year, req.params.month);
  const records = await listRecordsForActor(req.user, dateRange);
  res.status(200).json({ success: true, data: { records } });
});

export const listByDay = asyncHandler(async (req, res) => {
  const dateRange = buildDateRange(req.params.year, req.params.month, req.params.day);
  const records = await listRecordsForActor(req.user, dateRange);
  res.status(200).json({ success: true, data: { records } });
});

// Version liviana de listByMonth: solo id/fechaServicio/estado, para armar el
// acordeon de dias sin traer stops/ruta/economico de cada registro del mes.
export const listSummaryByMonth = asyncHandler(async (req, res) => {
  const dateRange = buildDateRange(req.params.year, req.params.month);
  const records = await listRecordsSummaryForActor(req.user, dateRange);
  res.status(200).json({ success: true, data: { records } });
});

export const getById = asyncHandler(async (req, res) => {
  const record = await getRecordByIdForActor(req.user, req.params.id);
  res.status(200).json({ success: true, data: { record } });
});

export const update = asyncHandler(async (req, res) => {
  const record = await updateRecordForActor(req.user, req.params.id, req.body);
  res.status(200).json({ success: true, data: { record } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteRecord(req.params.id);
  res.status(204).send();
});

// A demanda desde el mapa: solo se pide para el servicio que el OWNER/ADMIN tiene
// abierto/seleccionado en ese momento, no para todos los servicios activos.
export const getLiveEta = asyncHandler(async (req, res) => {
  const eta = await getLiveEtaForRecord(req.params.id);
  res.status(200).json({ success: true, data: { eta } });
});
