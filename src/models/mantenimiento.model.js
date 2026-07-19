import { prisma } from "../config/prisma.js";

export const createMantenimiento = (data) => prisma.mantenimientoVehiculo.create({ data });

export const findMantenimientosByVehicleId = (vehiculoId) =>
  prisma.mantenimientoVehiculo.findMany({
    where: { vehiculoId },
    include: { usuario: true },
    orderBy: { createdAt: "desc" },
  });

export const findMantenimientoById = (id) => prisma.mantenimientoVehiculo.findUnique({ where: { id } });

export const deleteMantenimientoById = (id) => prisma.mantenimientoVehiculo.delete({ where: { id } });
