import {
  createClient as createClientRecord,
  deleteClientById,
  findClientById,
  findClients,
  updateClientById,
} from "../models/client.model.js";
import { AppError } from "../utils/AppError.js";

export const listClients = () => findClients();

export const createClient = (data) => createClientRecord(data);

export const updateClient = async (id, data) => {
  const client = await findClientById(id);
  if (!client) {
    throw new AppError("Cliente no encontrado", 404);
  }
  return updateClientById(id, data);
};

export const deleteClient = async (id) => {
  const client = await findClientById(id);
  if (!client) {
    throw new AppError("Cliente no encontrado", 404);
  }
  await deleteClientById(id);
};
