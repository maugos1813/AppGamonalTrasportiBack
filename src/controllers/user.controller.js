import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updateUser,
  uploadUserAvatar,
} from "../services/user.service.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
