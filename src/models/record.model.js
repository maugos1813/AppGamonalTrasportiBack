import { prisma } from "../config/prisma.js";

const RECORD_INCLUDE = {
  driver: { select: { id: true, nombre: true, apellido: true } },
  vehicle: { select: { id: true, targa: true, modelo: true } },
  client: { select: { id: true, nombre: true } },
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

export const deleteRecordById = (id) => prisma.record.delete({ where: { id } });
