import {
  createClient,
  deleteClient,
  listClients,
  updateClient,
} from "../services/client.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const list = asyncHandler(async (req, res) => {
  const clients = await listClients();
  res.status(200).json({ success: true, data: { clients } });
});

export const create = asyncHandler(async (req, res) => {
  const client = await createClient(req.body);
  res.status(201).json({ success: true, data: { client } });
});

export const update = asyncHandler(async (req, res) => {
  const client = await updateClient(req.params.id, req.body);
  res.status(200).json({ success: true, data: { client } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteClient(req.params.id);
  res.status(204).send();
});
