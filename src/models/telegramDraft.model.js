import { prisma } from "../config/prisma.js";

export const findDraftByChat = (chatId) => prisma.telegramDraft.findUnique({ where: { chatId } });

export const upsertDraft = (chatId, messages) =>
  prisma.telegramDraft.upsert({
    where: { chatId },
    // pendingPriceRecordId en null explicito: esta funcion es solo para la
    // conversacion normal (con Claude), nunca debe dejar un pedido de precio a medias
    // colgado de una vuelta anterior.
    update: { messages, pendingPriceRecordId: null },
    create: { chatId, messages },
  });

// El servicio ya se creo y falta unicamente el precio por km (ver
// handleIncomingTelegramMessage) - se guarda aparte del historial de mensajes porque
// esa respuesta no pasa por Claude, se parsea como numero directo.
export const setPendingPrice = (chatId, recordId) =>
  prisma.telegramDraft.upsert({
    where: { chatId },
    update: { messages: [], pendingPriceRecordId: recordId },
    create: { chatId, messages: [], pendingPriceRecordId: recordId },
  });

export const deleteDraft = (chatId) =>
  prisma.telegramDraft.delete({ where: { chatId } }).catch(() => null);
