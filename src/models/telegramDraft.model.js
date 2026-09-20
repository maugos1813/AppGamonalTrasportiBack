import { prisma } from "../config/prisma.js";

export const findDraftByChat = (chatId) => prisma.telegramDraft.findUnique({ where: { chatId } });

export const upsertDraft = (chatId, messages) =>
  prisma.telegramDraft.upsert({
    where: { chatId },
    update: { messages },
    create: { chatId, messages },
  });

export const deleteDraft = (chatId) =>
  prisma.telegramDraft.delete({ where: { chatId } }).catch(() => null);
