import {
  createRecord,
  deleteRecord,
  getRecordByIdForActor,
  listRecordsForActor,
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
