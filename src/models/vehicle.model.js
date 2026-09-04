import { prisma } from "../config/prisma.js";

export const createVehicle = (data) => prisma.vehiculo.create({ data });

export const findVehicleById = (id) => prisma.vehiculo.findUnique({ where: { id } });

export const findVehicles = () => prisma.vehiculo.findMany({ orderBy: { createdAt: "desc" } });

// Version liviana de arriba (solo id/targa, sin imagenes/mantenimiento/etc.) - para el
// cruce con el GPS de Velocity Fleet, que solo necesita mapear targa -> vehicleId (ver
// listVehicleLivePositionsForActor en vehicle.service.js). Menos columnas viajando en
// cada consulta a Neon.
export const findVehicleIdsAndTargas = () =>
  prisma.vehiculo.findMany({ select: { id: true, targa: true } });

export const updateVehicleById = (id, data) => prisma.vehiculo.update({ where: { id }, data });

export const deleteVehicleById = (id) => prisma.vehiculo.delete({ where: { id } });
