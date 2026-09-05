import { prisma } from "../config/prisma.js";

export const createVehicle = (data) => prisma.vehiculo.create({ data });

export const findVehicleById = (id) => prisma.vehiculo.findUnique({ where: { id } });

export const findVehicles = () => prisma.vehiculo.findMany({ orderBy: { createdAt: "desc" } });

// Version liviana de arriba (sin imagenes/mantenimiento/etc.) - para el cruce con el
// GPS de Velocity Fleet, que solo necesita mapear targa -> vehicleId, y para saber
// cuales NO tienen autorizadoAreaC al detectar entradas al Area C (ver
// listVehicleLivePositionsForActor/checkAreaCEntries en vehicle.service.js). Menos
// columnas viajando en cada consulta a Neon.
export const findVehicleIdsAndTargas = () =>
  prisma.vehiculo.findMany({ select: { id: true, targa: true, autorizadoAreaC: true } });

export const updateVehicleById = (id, data) => prisma.vehiculo.update({ where: { id }, data });

export const deleteVehicleById = (id) => prisma.vehiculo.delete({ where: { id } });
