import { Env, TelegramUpdate } from "./types";
import { setWebhook } from "./telegram";
import { handleStart, handleTimes, handleHelp, handleSettings, handleSetCity, handleCallback, handleAdmin } from "./handlers";
import { handleCron } from "./cron";
import { getUser } from "./db";
import {
  verifyWebhookSecret,
  checkRateLimit,
  isUserBanned,
  isValidMessage,
} from "./security";
import { sendMessage } from "./telegram";

export default {
  // ══════════════════════════════════════════════
  //  HTTP Handler
  // ══════════════════════════════════════════════
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ── GET /setup?token=ADMIN_SECRET → Webhook registrieren ──
    // Geschützt: nur mit korrektem Token aufrufbar
    if (url.pathname === "/setup") {
      const token = url.searchParams.get("token");
      if (token !== env.WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      const webhookUrl = `${url.origin}/webhook`;
      const result = await setWebhook(env, webhookUrl, env.WEBHOOK_SECRET);
      return new Response(result, { status: 200 });
    }

    // ── POST /webhook → Telegram Updates ──
    if (url.pathname === "/webhook" && request.method === "POST") {

      // 🔒 Webhook Secret prüfen
      if (!verifyWebhookSecret(request, env)) {
        return new Response("Forbidden", { status: 403 });
      }

      try {
        const update = (await request.json()) as TelegramUpdate;
        await processUpdate(env, update);
      } catch (err) {
        console.error("Webhook Error:", err);
      }
      return new Response("OK", { status: 200 });
    }

    // ── Health Check (harmlos, kein Schutz nötig) ──
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // Alles andere → 404 (keine Info preisgeben)
    return new Response("Not Found", { status: 404 });
  },

  // ══════════════════════════════════════════════
  //  Cron Handler
  // ══════════════════════════════════════════════
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleCron(env));
  },
};

// ══════════════════════════════════════════════
//  Update-Router mit Security Checks
// ══════════════════════════════════════════════

async function processUpdate(env: Env, update: TelegramUpdate): Promise<void> {
  // ── Callback Queries ──
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat.id;
    const messageId = cb.message?.message_id;
    if (!chatId || !messageId || !cb.data) return;

    // 🔒 Ban-Check
    if (await isUserBanned(env, chatId)) return;

    // 🔒 Rate Limit
    const rateCheck = await checkRateLimit(env, chatId);
    if (!rateCheck.allowed) return; // Stille Ablehnung bei Buttons

    await handleCallback(env, cb.id, chatId, messageId, cb.data);
    return;
  }

  // ── Text-Nachrichten ──
  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;

  // 🔒 Ban-Check
  if (await isUserBanned(env, chatId)) return;

  // 🔒 Rate Limit
  const rateCheck = await checkRateLimit(env, chatId);
  if (!rateCheck.allowed) {
    await sendMessage(env, chatId,
      `⚠️ Du sendest zu viele Nachrichten.\n` +
      `Bitte warte ${rateCheck.retryAfter} Sekunden.`
    );
    return;
  }

  // 🔒 Nachricht validieren
  if (!isValidMessage(msg.text)) return;

  const text = msg.text.trim();

  // ── Admin-Befehle ──
  if (text.startsWith("/admin")) {
    await handleAdmin(env, chatId, text);
    return;
  }

  // ── Reguläre Befehle ──
  switch (text.split("@")[0]) {
    case "/start":
      await handleStart(env, chatId, msg.chat.first_name);
      return;
    case "/times":
    case "/zeiten":
      await handleTimes(env, chatId);
      return;
    case "/settings":
    case "/einstellungen":
      await handleSettings(env, chatId);
      return;
    case "/help":
    case "/hilfe":
      await handleHelp(env, chatId);
      return;
  }

  // Kein Befehl → Stadt-Eingabe?
  if (text.includes(",") || text.split(/\s+/).length >= 2) {
    const user = await getUser(env, chatId);
    if (!user || text.includes(",")) {
      await handleSetCity(env, chatId, text);
      return;
    }
  }

  await sendMessage(env, chatId,
    `Ich hab das nicht verstanden. 🤔\n\n` +
    `Nutze /help für eine Übersicht der Befehle,\n` +
    `oder schreib eine Stadt im Format:\n` +
    `<code>Berlin, Germany</code>`
  );
}
