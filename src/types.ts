// ── Cloudflare Worker Environment ──
export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  ADMIN_CHAT_ID: string;
  PRAYER_CACHE: KVNamespace;
  DB: D1Database;
}

// ── Prayer Names ──
export const PRAYER_NAMES = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];

// Label-Mapping für hübsche Ausgabe
export const PRAYER_LABELS: Record<PrayerName, string> = {
  Fajr: "🌅 Fajr",
  Dhuhr: "☀️ Dhuhr",
  Asr: "🌤️ Asr",
  Maghrib: "🌇 Maghrib",
  Isha: "🌙 Isha",
};

// ── User Settings ──
export interface UserSettings {
  chat_id: number;
  city: string;
  country: string;
  timezone: string;
  reminder_minutes: number;
  daily_overview: number;  // D1 hat kein Boolean → 0/1
  reminder_fajr: number;
  reminder_dhuhr: number;
  reminder_asr: number;
  reminder_maghrib: number;
  reminder_isha: number;
  created_at: string;
  updated_at: string;
}

// Helper: DB-Row zu einem reminders-Objekt
export function userReminders(u: UserSettings): Record<PrayerName, boolean> {
  return {
    Fajr: u.reminder_fajr === 1,
    Dhuhr: u.reminder_dhuhr === 1,
    Asr: u.reminder_asr === 1,
    Maghrib: u.reminder_maghrib === 1,
    Isha: u.reminder_isha === 1,
  };
}

// Helper: Prayer-Name → DB-Spaltenname
export function reminderColumn(prayer: PrayerName): string {
  return `reminder_${prayer.toLowerCase()}`;
}

// ── Prayer Times (von Aladhan API) ──
export interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface CachedPrayerData {
  times: PrayerTimes;
  date: string;
}

// ── Telegram Types ──
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; first_name?: string };
  text?: string;
  location?: { latitude: number; longitude: number };
}

export interface TelegramCallbackQuery {
  id: string;
  from: { id: number };
  message?: { chat: { id: number }; message_id: number };
  data?: string;
}
