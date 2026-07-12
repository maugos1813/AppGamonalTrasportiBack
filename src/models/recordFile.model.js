import { prisma } from "../config/prisma.js";

export const createRecordFile = (data) => prisma.recordFile.create({ data });

export const findRecordFileById = (id) => prisma.recordFile.findUnique({ where: { id } });

export const findRecordFilesByRecordId = (recordId) =>
  prisma.recordFile.findMany({ where: { recordId }, orderBy: { createdAt: "desc" } });

export const deleteRecordFileById = (id) => prisma.recordFile.delete({ where: { id } });
