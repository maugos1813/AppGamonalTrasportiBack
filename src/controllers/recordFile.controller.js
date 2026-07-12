import {
  createFileForRecord,
  deleteFile,
  listFilesForRecord,
} from "../services/recordFile.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const create = asyncHandler(async (req, res) => {
  const file = await createFileForRecord(req.user, req.params.id, req.body.tipoArchivo, req.file);
  res.status(201).json({ success: true, data: { file } });
});

export const list = asyncHandler(async (req, res) => {
  const files = await listFilesForRecord(req.user, req.params.id);
  res.status(200).json({ success: true, data: { files } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteFile(req.params.id);
  res.status(204).send();
});
