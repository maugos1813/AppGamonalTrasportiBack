import { getVelocityFleetUsageStats } from "../services/velocityFleet.service.js";
import {
  createVehicleRecordForActor,
  deleteMantenimientoForActor,
  deleteVehicleForActor,
  getVehicleByIdForActor,
  listMantenimientosForActor,
  listVehicleLivePositionsForActor,
  listVehiclesForActor,
  registerKmForActor,
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

export const listLivePositions = asyncHandler(async (req, res) => {
  const positions = await listVehicleLivePositionsForActor();
  res.status(200).json({ success: true, data: { positions } });
});

// Monitoreo de uso de Velocity Fleet (medida de optimizacion de costos): expone el
// contador en memoria de velocityFleet.service.js para poder notar un pico anormal de
// consultas antes de que impacte en la factura.
export const getVelocityFleetUsage = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: getVelocityFleetUsageStats() });
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

export const registerKm = asyncHandler(async (req, res) => {
  const vehicle = await registerKmForActor(req.params.id, req.body, req.user.id);
  res.status(200).json({ success: true, data: { vehicle } });
});

export const listMantenimientos = asyncHandler(async (req, res) => {
  const mantenimientos = await listMantenimientosForActor(req.params.id);
  res.status(200).json({ success: true, data: { mantenimientos } });
});

export const removeMantenimiento = asyncHandler(async (req, res) => {
  await deleteMantenimientoForActor(req.params.id, req.params.mantenimientoId);
  res.status(204).send();
});
