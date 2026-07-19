import { randomUUID } from "node:crypto";
import {
  createVehicle as createVehicleRecord,
  deleteVehicleById,
  findVehicleById,
  findVehicles,
  updateVehicleById,
} from "../models/vehicle.model.js";
import {
  createMantenimiento,
  deleteMantenimientoById,
  findMantenimientoById,
  findMantenimientosByVehicleId,
} from "../models/mantenimiento.model.js";
import { deleteObject, getSignedUrlForKey, uploadObject } from "./storage.service.js";
import { compressImage } from "../utils/imageProcessor.js";
import { AppError } from "../utils/AppError.js";

const FILE_FIELDS = ["imagen", "libreto", "assicurazione"];

// imagen se comprime con Sharp igual que en documentos; libreto/assicurazione ya vienen
// validados como PDF por vehicleUpload.js y se suben tal cual.
const uploadVehicleFile = async (file, field, vehicleId) => {
  if (!file) return null;

  const { buffer, contentType, ext } =
    field === "imagen"
      ? { buffer: await compressImage(file.buffer), contentType: "image/webp", ext: "webp" }
      : { buffer: file.buffer, contentType: "application/pdf", ext: "pdf" };

  const key = `vehiculos/${vehicleId}/${field}-${Date.now()}-${randomUUID()}.${ext}`;
  await uploadObject(key, buffer, contentType);
  return key;
};

// El bucket es privado: la respuesta siempre lleva URLs firmadas frescas, nunca las keys internas.
const toResponse = async (vehicle) => ({
  id: vehicle.id,
  targa: vehicle.targa,
  modelo: vehicle.modelo,
  imagenUrl: vehicle.imagenKey ? await getSignedUrlForKey(vehicle.imagenKey) : null,
  libretoUrl: vehicle.libretoKey ? await getSignedUrlForKey(vehicle.libretoKey) : null,
  assicurazioneUrl: vehicle.assicurazioneKey ? await getSignedUrlForKey(vehicle.assicurazioneKey) : null,
  area: vehicle.area,
  grupo: vehicle.grupo,
  estado: vehicle.estado,
  poliza: vehicle.poliza,
  rTecnica: vehicle.rTecnica,
  kmUltimoMantenimiento: vehicle.kmUltimoMantenimiento,
  kmActual: vehicle.kmActual,
  createdAt: vehicle.createdAt,
  updatedAt: vehicle.updatedAt,
});

export const createVehicleRecordForActor = async (data, files) => {
  const id = randomUUID();

  const [imagenKey, libretoKey, assicurazioneKey] = await Promise.all(
    FILE_FIELDS.map((field) => uploadVehicleFile(files?.[field]?.[0], field, id))
  );

  const vehicle = await createVehicleRecord({
    id,
    targa: data.targa,
    modelo: data.modelo,
    area: data.area,
    grupo: data.grupo,
    estado: data.estado ?? "DISPONIBLE",
    poliza: data.poliza,
    rTecnica: data.rTecnica,
    kmUltimoMantenimiento: data.kmUltimoMantenimiento,
    kmActual: data.kmActual,
    imagenKey,
    libretoKey,
    assicurazioneKey,
  });

  return toResponse(vehicle);
};

export const listVehiclesForActor = async () => {
  const vehicles = await findVehicles();
  return Promise.all(vehicles.map(toResponse));
};

export const getVehicleByIdForActor = async (id) => {
  const vehicle = await findVehicleById(id);
  if (!vehicle) {
    throw new AppError("Vehiculo no encontrado", 404);
  }
  return toResponse(vehicle);
};

export const updateVehicleForActor = async (id, data, files) => {
  const vehicle = await findVehicleById(id);
  if (!vehicle) {
    throw new AppError("Vehiculo no encontrado", 404);
  }

  const payload = { ...data };

  for (const field of FILE_FIELDS) {
    const file = files?.[field]?.[0];
    if (!file) continue;

    const keyField = `${field}Key`;
    const newKey = await uploadVehicleFile(file, field, id);

    if (vehicle[keyField]) {
      await deleteObject(vehicle[keyField]);
    }

    payload[keyField] = newKey;
  }

  const updated = await updateVehicleById(id, payload);
  return toResponse(updated);
};

// El chequeo de Mecanica es un endpoint aparte del PATCH generico: cada guardado
// deja constancia en el historial ademas de actualizar los valores "actuales" del
// vehiculo, para no perder el rastro de lecturas anteriores.
export const registerKmForActor = async (id, data, actorId) => {
  const vehicle = await findVehicleById(id);
  if (!vehicle) {
    throw new AppError("Vehiculo no encontrado", 404);
  }

  const kmUltimoMantenimiento = data.kmUltimoMantenimiento ?? vehicle.kmUltimoMantenimiento;
  const kmActual = data.kmActual ?? vehicle.kmActual;

  if (kmUltimoMantenimiento == null || kmActual == null) {
    throw new AppError("Cargar KM Ultimo Mantenimiento y KM Actual", 400);
  }

  const [updated] = await Promise.all([
    updateVehicleById(id, { kmUltimoMantenimiento, kmActual }),
    createMantenimiento({ vehiculoId: id, kmUltimoMantenimiento, kmActual, usuarioId: actorId }),
  ]);

  return toResponse(updated);
};

const toMantenimientoResponse = (registro) => ({
  id: registro.id,
  kmUltimoMantenimiento: registro.kmUltimoMantenimiento,
  kmActual: registro.kmActual,
  usuario: registro.usuario ? `${registro.usuario.nombre} ${registro.usuario.apellido}` : null,
  createdAt: registro.createdAt,
});

export const listMantenimientosForActor = async (id) => {
  const registros = await findMantenimientosByVehicleId(id);
  return registros.map(toMantenimientoResponse);
};

export const deleteMantenimientoForActor = async (vehiculoId, mantenimientoId) => {
  const registro = await findMantenimientoById(mantenimientoId);
  if (!registro || registro.vehiculoId !== vehiculoId) {
    throw new AppError("Registro de mantenimiento no encontrado", 404);
  }

  await deleteMantenimientoById(mantenimientoId);
};

export const deleteVehicleForActor = async (id) => {
  const vehicle = await findVehicleById(id);
  if (!vehicle) {
    throw new AppError("Vehiculo no encontrado", 404);
  }

  const keysToDelete = [vehicle.imagenKey, vehicle.libretoKey, vehicle.assicurazioneKey].filter(Boolean);
  await Promise.all(keysToDelete.map(deleteObject));

  await deleteVehicleById(id);
};
