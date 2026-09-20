import { Router } from "express";
import { webhook } from "../controllers/telegram.controller.js";

const router = Router();

// Sin authenticate: Telegram no manda un Bearer token nuestro, la seguridad pasa por
// el X-Telegram-Bot-Api-Secret-Token (ver telegram.controller.js/isValidWebhookSecret)
// mas la lista blanca de chat_id.
router.post("/webhook", webhook);

export default router;
