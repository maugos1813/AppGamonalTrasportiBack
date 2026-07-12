import { prisma } from "../config/prisma.js";

export const createVehicle = (data) => prisma.vehiculo.create({ data });

export const findVehicleById = (id) => prisma.vehiculo.findUnique({ where: { id } });

export const findVehicles = () => prisma.vehiculo.findMany({ orderBy: { createdAt: "desc" } });

export const updateVehicleById = (id, data) => prisma.vehiculo.update({ where: { id }, data });

export const deleteVehicleById = (id) => prisma.vehiculo.delete({ where: { id } });
