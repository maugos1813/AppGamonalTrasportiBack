import { randomUUID } from "node:crypto";
import {
  createUser as createUserRecord,
  deleteUserById,
  findAllUsers,
  findUserById,
  findUsersWithFreshLocation,
  updateUserById,
  updateUserLocation,
} from "../models/user.model.js";
import { findActiveRecordsByDriverIds } from "../models/record.model.js";
import { purgeDocumentsForUser } from "./document.service.js";
import { deleteObject, getSignedUrlForKey, uploadObject } from "./storage.service.js";
import { compressAvatar } from "../utils/imageProcessor.js";
import { AppError } from "../utils/AppError.js";
import { hashPassword } from "../utils/password.js";

// Solo un OWNER puede crear o ascender a otro usuario a OWNER; evita que un ADMIN se autoascienda.
const assertCanAssignCargo = (actor, cargo) => {
  if (cargo === "OWNER" && actor.cargo !== "OWNER") {
    throw new AppError("Solo un OWNER puede asignar el cargo OWNER", 403);
  }
};

// Campos que un CHOFER puede modificar sobre si mismo; cargo/area/estado quedan fuera
// para que no pueda autoasignarse privilegios ni reactivarse si fue desactivado.
const SELF_EDITABLE_FIELDS = ["nombre", "apellido", "numeroCelular", "password"];

// El bucket es privado: nunca se expone la key interna, siempre una URL firmada fresca.
export const toUserResponse = async (user) => {
  const { imagenPerfilKey, ...rest } = user;
  return {
    ...rest,
    imagenUrl: imagenPerfilKey ? await getSignedUrlForKey(imagenPerfilKey) : null,
  };
};

export const listUsers = async () => {
  const users = await findAllUsers();
  return Promise.all(users.map(toUserResponse));
};

export const getUserById = async (id) => {
  const user = await findUserById(id);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }
  return toUserResponse(user);
};

export const createUser = async (actor, data) => {
  assertCanAssignCargo(actor, data.cargo);

  const hashedPassword = await hashPassword(data.password);

  const user = await createUserRecord({
    ...data,
    estado: data.estado ?? "ACTIVO",
    password: hashedPassword,
  });
  return toUserResponse(user);
};

export const updateUser = async (actor, targetId, data) => {
  const isSelf = actor.id === targetId;
  const isPrivileged = actor.cargo === "OWNER" || actor.cargo === "ADMIN";

  let payload = data;

  if (isSelf && !isPrivileged) {
    payload = Object.fromEntries(
      Object.entries(data).filter(([key]) => SELF_EDITABLE_FIELDS.includes(key))
    );
  }

  if (payload.cargo) {
    assertCanAssignCargo(actor, payload.cargo);
  }

  if (payload.password) {
    payload = { ...payload, password: await hashPassword(payload.password) };
  }

  const user = await findUserById(targetId);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const updated = await updateUserById(targetId, payload);
  return toUserResponse(updated);
};

export const uploadUserAvatar = async (targetId, file) => {
  const user = await findUserById(targetId);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const buffer = await compressAvatar(file.buffer);
  const key = `avatars/${targetId}/avatar-${Date.now()}-${randomUUID()}.webp`;
  await uploadObject(key, buffer, "image/webp");

  if (user.imagenPerfilKey) {
    await deleteObject(user.imagenPerfilKey);
  }

  const updated = await updateUserById(targetId, { imagenPerfilKey: key });
  return toUserResponse(updated);
};

const LOCATION_FRESH_MINUTES = 5;

export const updateMyLocation = (actorId, { lat, lng }) => updateUserLocation(actorId, lat, lng);

// Solo se exponen choferes con ubicacion reciente Y un servicio en camino ahora mismo
// (no se rastrea fuera de un viaje activo).
export const listActiveDriverLocations = async () => {
  const since = new Date(Date.now() - LOCATION_FRESH_MINUTES * 60 * 1000);
  const users = await findUsersWithFreshLocation(since);
  if (users.length === 0) return [];

  const activeRecords = await findActiveRecordsByDriverIds(users.map((u) => u.id));
  const recordByDriverId = Object.fromEntries(activeRecords.map((r) => [r.driverId, r]));

  return users
    .filter((u) => recordByDriverId[u.id])
    .map((u) => ({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      lat: u.ubicacionLat,
      lng: u.ubicacionLng,
      actualizada: u.ubicacionActualizada,
      servicio: recordByDriverId[u.id],
    }));
};

export const deleteUser = async (actor, targetId) => {
  if (actor.id === targetId) {
    throw new AppError("No puedes eliminar tu propia cuenta", 400);
  }

  const user = await findUserById(targetId);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  // Se borran los objetos de R2 antes de la fila: el ON DELETE CASCADE limpia la tabla
  // documentos automaticamente, pero no sabe nada de R2, y dejaria archivos huerfanos en el bucket.
  await purgeDocumentsForUser(targetId);
  if (user.imagenPerfilKey) {
    await deleteObject(user.imagenPerfilKey);
  }

  await deleteUserById(targetId);
};
