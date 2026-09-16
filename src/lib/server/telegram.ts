import "server-only";

type Button = { text: string; callback_data?: string; url?: string };
const api = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export const telegramConfigured = () => !!process.env.TELEGRAM_BOT_TOKEN;
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(api(method), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`);
  return j.result as T;
}

export async function send(chatId: number, html: string, buttons?: Button[][]) {
  if (!telegramConfigured()) return null;
  return call<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: buttons?.length ? { inline_keyboard: buttons } : undefined,
  });
}

export async function editButtons(chatId: number, messageId: number, buttons: Button[][] | null) {
  return call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: buttons ?? [] } }).catch(() => null);
}

export async function answer(callbackId: string, text: string) {
  return call("answerCallbackQuery", { callback_query_id: callbackId, text }).catch(() => null);
}

export async function sendDocument(chatId: number, filename: string, content: string, caption?: string) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption);
  form.append("document", new Blob(["﻿" + content], { type: "text/csv" }), filename);
  const r = await fetch(api("sendDocument"), { method: "POST", body: form });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram sendDocument: ${j.description}`);
}

export async function setWebhook(url: string) {
  await call("setWebhook", { url, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["message", "callback_query"] });
  await call("setMyCommands", {
    commands: [
      { command: "hoje", description: "O resumo de hoje" },
      { command: "semana", description: "O resumo desta semana" },
    ],
  }).catch(() => null);
  return call<{ username: string }>("getMe", {});
}

export async function botInfo() {
  if (!telegramConfigured()) return null;
  try {
    const me = await call<{ username: string }>("getMe", {});
    const wh = await call<{ url: string; last_error_message?: string }>("getWebhookInfo", {});
    return { username: me.username, webhook: wh.url, lastError: wh.last_error_message ?? null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
