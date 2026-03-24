import { Env } from "./types";

const TG_BASE = "https://api.telegram.org/bot";

function url(env: Env, method: string): string {
  return `${TG_BASE}${env.TELEGRAM_BOT_TOKEN}/${method}`;
}

// ── Nachricht senden ──
export async function sendMessage(
  env: Env,
  chatId: number,
  text: string,
  options?: {
    reply_markup?: object;
    parse_mode?: "HTML" | "MarkdownV2";
  }
): Promise<void> {
  await fetch(url(env, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode ?? "HTML",
      reply_markup: options?.reply_markup,
    }),
  });
}

// ── Nachricht bearbeiten (für Inline-Button Updates) ──
export async function editMessage(
  env: Env,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: object
): Promise<void> {
  await fetch(url(env, "editMessageText"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
  });
}

// ── Callback Query beantworten (Loading-Spinner entfernen) ──
export async function answerCallback(env: Env, callbackQueryId: string, text?: string): Promise<void> {
  await fetch(url(env, "answerCallbackQuery"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
}

// ── Webhook setzen (einmalig bei Setup) ──
export async function setWebhook(env: Env, webhookUrl: string, secretToken?: string): Promise<string> {
  const res = await fetch(url(env, "setWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken, // Telegram schickt diesen Token bei jedem Update mit
      allowed_updates: ["message", "callback_query"], // Nur was wir brauchen
      max_connections: 40,
    }),
  });
  const data = (await res.json()) as { ok: boolean; description?: string };
  return data.ok ? "✅ Webhook gesetzt!" : `❌ Fehler: ${data.description}`;
}
