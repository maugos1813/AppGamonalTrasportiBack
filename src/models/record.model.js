import { prisma } from "../config/prisma.js";

const RECORD_INCLUDE = {
  driver: { select: { id: true, nombre: true, apellido: true } },
  vehicle: { select: { id: true, targa: true, modelo: true } },
  client: { select: { id: true, nombre: true } },
  stops: { orderBy: { orden: "asc" } },
};

export const createRecord = (data) =>
  prisma.record.create({ data, include: RECORD_INCLUDE });

export const findRecordById = (id) =>
  prisma.record.findUnique({ where: { id }, include: RECORD_INCLUDE });

// filters: { driverId?: string, dateRange?: { gte: Date, lt: Date } }
export const findRecords = ({ driverId, dateRange } = {}) =>
  prisma.record.findMany({
    where: {
      ...(driverId ? { driverId } : {}),
      ...(dateRange ? { fechaServicio: { gte: dateRange.gte, lt: dateRange.lt } } : {}),
    },
    include: RECORD_INCLUDE,
    orderBy: { fechaServicio: "desc" },
  });

export const updateRecordById = (id, data) =>
  prisma.record.update({ where: { id }, data, include: RECORD_INCLUDE });

// Usado por el mapa de ubicaciones: solo se muestra un chofer si tiene un
// servicio en camino ahora mismo. "ultimaParada" (la parada final) se usa para
// calcular la ruta en vivo desde la posicion actual del chofer.
export const findActiveRecordsByDriverIds = (driverIds) =>
  prisma.record.findMany({
    where: { estado: "IN_CONSEGNA", driverId: { in: driverIds } },
    select: {
      driverId: true,
      codigo: true,
      destinazione: true,
      stops: {
        orderBy: { orden: "desc" },
        take: 1,
        select: { lat: true, lng: true },
      },
    },
  });

export const deleteRecordById = (id) => prisma.record.delete({ where: { id } });
