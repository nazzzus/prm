import { Env } from "./types";

// ══════════════════════════════════════════════
//  1) WEBHOOK SECRET VERIFICATION
// ══════════════════════════════════════════════

/**
 * Telegram unterstützt einen secret_token Header beim Webhook.
 * Wenn gesetzt, schickt Telegram bei jedem Update den Header
 * "X-Telegram-Bot-Api-Secret-Token" mit.
 * 
 * → Alles ohne diesen Header wird abgelehnt.
 */
export function verifyWebhookSecret(request: Request, env: Env): boolean {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  return secret === env.WEBHOOK_SECRET;
}

// ══════════════════════════════════════════════
//  2) RATE LIMITING (KV-basiert)
// ══════════════════════════════════════════════

interface RateLimitEntry {
  count: number;
  window_start: number; // Unix timestamp (seconds)
}

const RATE_LIMIT_WINDOW = 60;        // 60 Sekunden Fenster
const RATE_LIMIT_MAX_REQUESTS = 10;  // Max 10 Nachrichten pro Minute
const RATE_LIMIT_BLOCK_DURATION = 300; // 5 Minuten Sperre bei Überschreitung

/**
 * Prüft ob ein User das Rate Limit überschritten hat.
 * Gibt { allowed: true } zurück wenn OK, sonst { allowed: false, retryAfter }.
 */
export async function checkRateLimit(
  env: Env,
  chatId: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = `ratelimit:${chatId}`;
  const now = Math.floor(Date.now() / 1000);

  // Prüfe ob User gesperrt ist
  const blockKey = `blocked:${chatId}`;
  const blocked = await env.PRAYER_CACHE.get(blockKey);
  if (blocked) {
    const blockedUntil = parseInt(blocked, 10);
    if (now < blockedUntil) {
      return { allowed: false, retryAfter: blockedUntil - now };
    }
    // Block abgelaufen → löschen
    await env.PRAYER_CACHE.delete(blockKey);
  }

  // Rate Limit prüfen
  const raw = await env.PRAYER_CACHE.get(key, "json") as RateLimitEntry | null;

  if (!raw || now - raw.window_start >= RATE_LIMIT_WINDOW) {
    // Neues Fenster starten
    await env.PRAYER_CACHE.put(key, JSON.stringify({ count: 1, window_start: now }), {
      expirationTtl: RATE_LIMIT_WINDOW * 2,
    });
    return { allowed: true };
  }

  if (raw.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Limit überschritten → User temporär sperren
    const blockedUntil = now + RATE_LIMIT_BLOCK_DURATION;
    await env.PRAYER_CACHE.put(blockKey, blockedUntil.toString(), {
      expirationTtl: RATE_LIMIT_BLOCK_DURATION,
    });
    return { allowed: false, retryAfter: RATE_LIMIT_BLOCK_DURATION };
  }

  // Counter erhöhen
  raw.count += 1;
  await env.PRAYER_CACHE.put(key, JSON.stringify(raw), {
    expirationTtl: RATE_LIMIT_WINDOW * 2,
  });
  return { allowed: true };
}

// ══════════════════════════════════════════════
//  3) INPUT VALIDATION & SANITIZATION
// ══════════════════════════════════════════════

const MAX_CITY_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 500;
const CITY_PATTERN = /^[\p{L}\p{M}\s\-'.]+$/u; // Unicode-Buchstaben, Leerzeichen, Bindestriche, Apostrophe

/**
 * Validiert und bereinigt eine Stadt/Land-Eingabe.
 */
export function sanitizeCityInput(text: string): { valid: boolean; city?: string; country?: string; error?: string } {
  // Längenbegrenzung
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: "Eingabe zu lang." };
  }

  const parts = text.split(/[,]+/).map((s) => s.trim()).filter(Boolean);

  if (parts.length < 2) {
    return { valid: false, error: "Bitte im Format: Stadt, Land" };
  }

  const city = parts[0].slice(0, MAX_CITY_LENGTH);
  const country = parts[1].slice(0, MAX_CITY_LENGTH);

  // Nur erlaubte Zeichen
  if (!CITY_PATTERN.test(city) || !CITY_PATTERN.test(country)) {
    return { valid: false, error: "Ungültige Zeichen in Stadt oder Land." };
  }

  return { valid: true, city, country };
}

/**
 * Grundlegende Nachrichtenvalidierung
 */
export function isValidMessage(text: string | undefined): text is string {
  return typeof text === "string" && text.length > 0 && text.length <= MAX_MESSAGE_LENGTH;
}

// ══════════════════════════════════════════════
//  4) ADMIN & BAN SYSTEM
// ══════════════════════════════════════════════

/**
 * Prüft ob ein User gebannt ist.
 * Permanente Bans werden in MongoDB gespeichert,
 * temporäre (Rate Limit) im KV Store.
 */
export async function isUserBanned(env: Env, chatId: number): Promise<boolean> {
  const key = `banned:${chatId}`;
  const banned = await env.PRAYER_CACHE.get(key);
  return banned === "true";
}

/**
 * User permanent bannen (nur via Admin-Befehl)
 */
export async function banUser(env: Env, chatId: number): Promise<void> {
  // Permanent im KV (kein TTL)
  await env.PRAYER_CACHE.put(`banned:${chatId}`, "true");
}

/**
 * User entbannen
 */
export async function unbanUser(env: Env, chatId: number): Promise<void> {
  await env.PRAYER_CACHE.delete(`banned:${chatId}`);
}

/**
 * Prüft ob der Absender ein Admin ist.
 */
export function isAdmin(chatId: number, env: Env): boolean {
  // ADMIN_CHAT_ID als Secret setzen (deine eigene Telegram chat_id)
  return chatId.toString() === env.ADMIN_CHAT_ID;
}

// ══════════════════════════════════════════════
//  5) MAX USERS CAP
// ══════════════════════════════════════════════

const MAX_USERS = 500; // Anpassbar — schützt den Cron-Job vor Explosion

/**
 * Prüft ob das User-Limit erreicht ist.
 * Nutzt einen einfachen Counter im KV Store.
 */
export async function canRegisterNewUser(env: Env): Promise<boolean> {
  const countStr = await env.PRAYER_CACHE.get("user_count");
  const count = countStr ? parseInt(countStr, 10) : 0;
  return count < MAX_USERS;
}

export async function incrementUserCount(env: Env): Promise<void> {
  const countStr = await env.PRAYER_CACHE.get("user_count");
  const count = countStr ? parseInt(countStr, 10) : 0;
  await env.PRAYER_CACHE.put("user_count", (count + 1).toString());
}

export async function decrementUserCount(env: Env): Promise<void> {
  const countStr = await env.PRAYER_CACHE.get("user_count");
  const count = countStr ? parseInt(countStr, 10) : 0;
  await env.PRAYER_CACHE.put("user_count", Math.max(0, count - 1).toString());
}
