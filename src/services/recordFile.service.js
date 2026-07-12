import { randomUUID } from "node:crypto";
import { findRecordById } from "../models/record.model.js";
import {
  createRecordFile as createRecordFileModel,
  deleteRecordFileById,
  findRecordFileById,
  findRecordFilesByRecordId,
} from "../models/recordFile.model.js";
import { deleteObject, getSignedUrlForKey, uploadObject } from "./storage.service.js";
import { compressImage } from "../utils/imageProcessor.js";
import { AppError } from "../utils/AppError.js";

const isPrivileged = (actor) => actor.cargo === "OWNER" || actor.cargo === "ADMIN";

const assertRecordAccess = (actor, record) => {
  if (isPrivileged(actor) || record.driverId === actor.id) return;
  throw new AppError("No tienes permisos para realizar esta accion", 403);
};

// Mismo criterio de procesamiento que document.service.js: PDFs tal cual, imagenes comprimidas con Sharp.
const processFile = async (file) => {
  if (file.mimetype === "application/pdf") {
    return { buffer: file.buffer, mimeType: "application/pdf", ext: "pdf" };
  }
  const buffer = await compressImage(file.buffer);
  return { buffer, mimeType: "image/webp", ext: "webp" };
};

const buildStorageKey = (recordId, tipoArchivo, ext) =>
  `records/${recordId}/${tipoArchivo}-${Date.now()}-${randomUUID()}.${ext}`;

const toResponse = async (file) => ({
  id: file.id,
  recordId: file.recordId,
  tipoArchivo: file.tipoArchivo,
  archivoUrl: await getSignedUrlForKey(file.archivoKey),
  createdAt: file.createdAt,
});

export const createFileForRecord = async (actor, recordId, tipoArchivo, file) => {
  const record = await findRecordById(recordId);
  if (!record) {
    throw new AppError("Registro no encontrado", 404);
  }
  assertRecordAccess(actor, record);

  if (!isPrivileged(actor) && tipoArchivo !== "FOTO_ENTREGA") {
    throw new AppError("Un chofer solo puede subir archivos de tipo FOTO_ENTREGA", 403);
  }

  if (!file) {
    throw new AppError("El archivo es obligatorio", 400);
  }

  const { buffer, mimeType, ext } = await processFile(file);
  const archivoKey = buildStorageKey(recordId, tipoArchivo, ext);
  await uploadObject(archivoKey, buffer, mimeType);

  const recordFile = await createRecordFileModel({ recordId, tipoArchivo, archivoKey });
  return toResponse(recordFile);
};

export const listFilesForRecord = async (actor, recordId) => {
  const record = await findRecordById(recordId);
  if (!record) {
    throw new AppError("Registro no encontrado", 404);
  }
  assertRecordAccess(actor, record);

  const files = await findRecordFilesByRecordId(recordId);
  return Promise.all(files.map(toResponse));
};

export const deleteFile = async (id) => {
  const file = await findRecordFileById(id);
  if (!file) {
    throw new AppError("Archivo no encontrado", 404);
  }

  await deleteObject(file.archivoKey);
  await deleteRecordFileById(id);
};

// Usado por record.service.js antes de borrar un record, para no dejar archivos huerfanos en R2.
export const purgeFilesForRecord = async (recordId) => {
  const files = await findRecordFilesByRecordId(recordId);
  await Promise.all(files.map((file) => deleteObject(file.archivoKey)));
};
