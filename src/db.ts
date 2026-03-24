import { Env, UserSettings, PrayerName, reminderColumn } from "./types";

// ══════════════════════════════════════════════
//  USER CRUD
// ══════════════════════════════════════════════

export async function getUser(env: Env, chatId: number): Promise<UserSettings | null> {
  const result = await env.DB.prepare(
    "SELECT * FROM users WHERE chat_id = ?"
  ).bind(chatId).first<UserSettings>();
  return result ?? null;
}

export async function getAllUsers(env: Env): Promise<UserSettings[]> {
  const result = await env.DB.prepare("SELECT * FROM users").all<UserSettings>();
  return result.results;
}

export async function createUser(
  env: Env,
  chatId: number,
  city: string,
  country: string,
  timezone: string
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO users (
      chat_id, city, country, timezone,
      reminder_minutes, daily_overview,
      reminder_fajr, reminder_dhuhr, reminder_asr, reminder_maghrib, reminder_isha,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 15, 1, 1, 1, 1, 1, 1, ?, ?)
  `).bind(chatId, city, country, timezone, now, now).run();
}

export async function updateCity(
  env: Env,
  chatId: number,
  city: string,
  country: string,
  timezone: string
): Promise<void> {
  await env.DB.prepare(`
    UPDATE users SET city = ?, country = ?, timezone = ?, updated_at = ?
    WHERE chat_id = ?
  `).bind(city, country, timezone, new Date().toISOString(), chatId).run();
}

export async function updateReminderMinutes(env: Env, chatId: number, minutes: number): Promise<void> {
  await env.DB.prepare(`
    UPDATE users SET reminder_minutes = ?, updated_at = ? WHERE chat_id = ?
  `).bind(minutes, new Date().toISOString(), chatId).run();
}

export async function updateDailyOverview(env: Env, chatId: number, enabled: boolean): Promise<void> {
  await env.DB.prepare(`
    UPDATE users SET daily_overview = ?, updated_at = ? WHERE chat_id = ?
  `).bind(enabled ? 1 : 0, new Date().toISOString(), chatId).run();
}

export async function togglePrayerReminder(env: Env, chatId: number, prayer: PrayerName): Promise<boolean> {
  const col = reminderColumn(prayer);
  // Toggle: 1→0, 0→1
  await env.DB.prepare(`
    UPDATE users SET ${col} = CASE WHEN ${col} = 1 THEN 0 ELSE 1 END, updated_at = ?
    WHERE chat_id = ?
  `).bind(new Date().toISOString(), chatId).run();

  // Neuen Wert zurückgeben
  const user = await getUser(env, chatId);
  return user ? (user[col as keyof UserSettings] as number) === 1 : false;
}

export async function setAllReminders(env: Env, chatId: number, enabled: boolean): Promise<void> {
  const val = enabled ? 1 : 0;
  await env.DB.prepare(`
    UPDATE users SET
      reminder_fajr = ?, reminder_dhuhr = ?, reminder_asr = ?,
      reminder_maghrib = ?, reminder_isha = ?, daily_overview = ?,
      updated_at = ?
    WHERE chat_id = ?
  `).bind(val, val, val, val, val, val, new Date().toISOString(), chatId).run();
}

// ══════════════════════════════════════════════
//  SENT REMINDERS TRACKING
// ══════════════════════════════════════════════

export async function wasReminderSent(
  env: Env,
  chatId: number,
  prayer: string,
  date: string,
  type: string
): Promise<boolean> {
  const result = await env.DB.prepare(`
    SELECT 1 FROM sent_reminders WHERE chat_id = ? AND prayer = ? AND date = ? AND type = ?
  `).bind(chatId, prayer, date, type).first();
  return result !== null;
}

export async function markReminderSent(
  env: Env,
  chatId: number,
  prayer: string,
  date: string,
  type: string
): Promise<void> {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO sent_reminders (chat_id, prayer, date, type)
    VALUES (?, ?, ?, ?)
  `).bind(chatId, prayer, date, type).run();
}

export async function cleanupOldReminders(env: Env): Promise<void> {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const dateStr = twoDaysAgo.toISOString().split("T")[0];

  await env.DB.prepare(
    "DELETE FROM sent_reminders WHERE date < ?"
  ).bind(dateStr).run();
}
