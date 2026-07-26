import {
  createUser,
  deleteUser,
  getDriverRouteHistory,
  getReturnEtaForDriver,
  getUserById,
  listActiveDriverLocations,
  listUsers,
  updateMyLocation,
  updateMyLocationPermission,
  updateMyReperibilidad,
  updateUser,
  uploadUserAvatar,
} from "../services/user.service.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildDateRange } from "../utils/dateRange.js";

export const list = asyncHandler(async (req, res) => {
  const users = await listUsers();
  res.status(200).json({ success: true, data: { users } });
});

export const getById = asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  res.status(200).json({ success: true, data: { user } });
});

export const create = asyncHandler(async (req, res) => {
  const user = await createUser(req.user, req.body);
  res.status(201).json({ success: true, data: { user } });
});

export const update = asyncHandler(async (req, res) => {
  const user = await updateUser(req.user, req.params.id, req.body);
  res.status(200).json({ success: true, data: { user } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteUser(req.user, req.params.id);
  res.status(204).send();
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("Debes seleccionar una imagen", 400);
  }
  const user = await uploadUserAvatar(req.params.id, req.file);
  res.status(200).json({ success: true, data: { user } });
});

export const updateMyLocationHandler = asyncHandler(async (req, res) => {
  await updateMyLocation(req.user.id, req.body);
  res.status(200).json({ success: true });
});

export const updateMyLocationPermissionHandler = asyncHandler(async (req, res) => {
  await updateMyLocationPermission(req.user.id, req.body.denegado);
  res.status(200).json({ success: true });
});

export const updateMyReperibilidadHandler = asyncHandler(async (req, res) => {
  const user = await updateMyReperibilidad(req.user.id, req.body.noDisponible);
  res.status(200).json({ success: true, data: { user } });
});

export const listLocations = asyncHandler(async (req, res) => {
  const ubicaciones = await listActiveDriverLocations();
  res.status(200).json({ success: true, data: { ubicaciones } });
});

// A demanda desde el mapa: solo se pide para el chofer libre que el OWNER/ADMIN tiene
// abierto/seleccionado en ese momento, no para todos los choferes libres en cada poll.
export const getReturnEtaHandler = asyncHandler(async (req, res) => {
  const eta = await getReturnEtaForDriver(req.params.id);
  res.status(200).json({ success: true, data: { eta } });
});

export const getRouteHistoryHandler = asyncHandler(async (req, res) => {
  const { gte, lt } = buildDateRange(req.params.year, req.params.month, req.params.day);
  const puntos = await getDriverRouteHistory(req.params.id, gte, lt);
  res.status(200).json({ success: true, data: { puntos } });
});
