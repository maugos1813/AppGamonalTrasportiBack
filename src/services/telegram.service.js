import { env } from "../config/env.js";

const TELEGRAM_API = "https://api.telegram.org";

// Le contesta al chat vía la API de Telegram (ver telegramAssistant.service.js, que
// arma el texto). Best-effort a propósito, igual que el resto de las integraciones
// externas de la app: si Telegram está caído no tiene sentido tirar un 500, ya
// perdimos el mensaje de todas formas.
export const sendTelegramMessage = async (chatId, text) => {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("No se pudo responder en Telegram:", res.status, body);
    }
  } catch (err) {
    console.error("No se pudo responder en Telegram:", err.message);
  }
};

// El header que Telegram manda en cada request al webhook (configurado al registrar
// la URL con /setWebhook, ver README) - si no coincide, no es un mensaje real de
// Telegram y se descarta sin procesar nada.
export const isValidWebhookSecret = (headerValue) => {
  if (!env.TELEGRAM_WEBHOOK_SECRET) return false;
  return headerValue === env.TELEGRAM_WEBHOOK_SECRET;
};

// Solo el chat configurado puede cargar servicios - cualquier otro (alguien que le
// escriba al bot desde afuera) se ignora en silencio, ni siquiera se le contesta para
// no confirmarle que el bot existe/está activo.
export const isAllowedChat = (chatId) =>
  Boolean(env.TELEGRAM_ALLOWED_CHAT_ID) && String(chatId) === env.TELEGRAM_ALLOWED_CHAT_ID;
