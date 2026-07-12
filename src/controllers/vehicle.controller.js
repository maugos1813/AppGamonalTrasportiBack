import {
  createVehicleRecordForActor,
  deleteVehicleForActor,
  getVehicleByIdForActor,
  listVehiclesForActor,
  updateVehicleForActor,
} from "../services/vehicle.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const create = asyncHandler(async (req, res) => {
  const vehicle = await createVehicleRecordForActor(req.body, req.files);
  res.status(201).json({ success: true, data: { vehicle } });
});

export const list = asyncHandler(async (req, res) => {
  const vehicles = await listVehiclesForActor();
  res.status(200).json({ success: true, data: { vehicles } });
});

export const getById = asyncHandler(async (req, res) => {
  const vehicle = await getVehicleByIdForActor(req.params.id);
  res.status(200).json({ success: true, data: { vehicle } });
});

export const update = asyncHandler(async (req, res) => {
  const vehicle = await updateVehicleForActor(req.params.id, req.body, req.files);
  res.status(200).json({ success: true, data: { vehicle } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteVehicleForActor(req.params.id);
  res.status(204).send();
});
