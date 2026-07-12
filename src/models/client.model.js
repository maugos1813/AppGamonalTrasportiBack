import { prisma } from "../config/prisma.js";

export const createClient = (data) => prisma.client.create({ data });

export const findClientById = (id) => prisma.client.findUnique({ where: { id } });

export const findClients = () => prisma.client.findMany({ orderBy: { nombre: "asc" } });

export const updateClientById = (id, data) => prisma.client.update({ where: { id }, data });

export const deleteClientById = (id) => prisma.client.delete({ where: { id } });
