// ── Cloudflare Worker Environment ──
export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  MONGODB_DATA_API_KEY: string;
  MONGODB_APP_ID: string;
  MONGODB_CLUSTER_NAME: string;
  MONGODB_DATABASE_NAME: string;
  WEBHOOK_SECRET: string;
  ADMIN_CHAT_ID: string;
  PRAYER_CACHE: KVNamespace;
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

// ── User Settings (MongoDB Document) ──
export interface UserSettings {
  _id?: string;
  chat_id: number;
  city: string;
  country: string;
  timezone: string;
  reminder_minutes: number; // Minuten vor dem Gebet
  daily_overview: boolean;
  reminders: Record<PrayerName, boolean>;
  created_at: string;
  updated_at: string;
}

// ── Prayer Times (von Aladhan API) ──
export interface PrayerTimes {
  Fajr: string;   // "05:23"
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface CachedPrayerData {
  times: PrayerTimes;
  date: string; // "YYYY-MM-DD"
}

// ── Sent Reminders Tracking ──
export interface SentReminder {
  _id?: string;
  chat_id: number;
  prayer: PrayerName;
  date: string;       // "YYYY-MM-DD"
  type: "reminder" | "overview";
}

// ── Telegram Types (nur was wir brauchen) ──
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
