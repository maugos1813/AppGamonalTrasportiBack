import { handleIncomingTelegramMessage } from "../services/telegramAssistant.service.js";
import { isAllowedChat, isValidWebhookSecret } from "../services/telegram.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Webhook de Telegram (ver README) - Telegram espera un 200 rapido y sin importar el
// resultado, asi que esto siempre contesta 200 (nunca reintenta un mensaje por un
// error nuestro) y el trabajo real (llamar a Claude, contestar en el chat) pasa antes
// de responder, no en background - los mensajes son cortos, entra comodo en el
// timeout del webhook.
export const webhook = asyncHandler(async (req, res) => {
  const secret = req.get("X-Telegram-Bot-Api-Secret-Token");
  if (!isValidWebhookSecret(secret)) {
    res.status(200).json({ success: true });
    return;
  }

  const message = req.body?.message;
  const chatId = message?.chat?.id;
  const text = message?.text;

  if (chatId != null && isAllowedChat(chatId) && typeof text === "string" && text.trim()) {
    await handleIncomingTelegramMessage(String(chatId), text.trim());
  }

  res.status(200).json({ success: true });
});
