import { prisma } from "../config/prisma.js";

export const findSyncState = (source) => prisma.syncState.findUnique({ where: { source } });

export const upsertSyncState = (source, data) =>
  prisma.syncState.upsert({
    where: { source },
    create: { source, ...data },
    update: data,
  });
