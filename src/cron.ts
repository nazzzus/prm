import { Env, PRAYER_NAMES, PRAYER_LABELS, PrayerName, UserSettings } from "./types";
import { getAllUsers, wasReminderSent, markReminderSent, cleanupOldReminders } from "./db";
import { getPrayerTimes, getCurrentTime, getTodayDate, getHijriDate, timeToMinutes } from "./prayers";
import { sendMessage } from "./telegram";

/**
 * Hauptfunktion: Wird jede Minute vom Cron-Trigger aufgerufen.
 *
 * 1. Alle User laden
 * 2. Für jeden User prüfen:
 *    a) Ist eine tägliche Übersicht fällig? (morgens um Fajr-Zeit)
 *    b) Ist eine Gebetserinnerung fällig? (X Min. vor einem Gebet)
 * 3. Alte Tracking-Einträge aufräumen (1x täglich)
 */
export async function handleCron(env: Env): Promise<void> {
  const users = await getAllUsers(env);
  if (users.length === 0) return;

  // Gebetszeiten pro Stadt cachen (innerhalb dieses Cron-Runs)
  const timesCache = new Map<string, Awaited<ReturnType<typeof getPrayerTimes>>>();

  for (const user of users) {
    try {
      await processUser(env, user, timesCache);
    } catch (err) {
      console.error(`Fehler bei User ${user.chat_id}:`, err);
    }
  }

  // Einmal pro Stunde alte Einträge aufräumen
  const now = new Date();
  if (now.getMinutes() === 0) {
    await cleanupOldReminders(env);
  }
}

async function processUser(
  env: Env,
  user: UserSettings,
  timesCache: Map<string, Awaited<ReturnType<typeof getPrayerTimes>>>
): Promise<void> {
  const cacheKey = `${user.city}:${user.country}`;
  const today = getTodayDate(user.timezone);
  const { minutes: currentMinutes } = getCurrentTime(user.timezone);

  // Gebetszeiten holen (gecached)
  if (!timesCache.has(cacheKey)) {
    const times = await getPrayerTimes(env, user.city, user.country);
    timesCache.set(cacheKey, times);
  }
  const times = timesCache.get(cacheKey)!;

  // ── 1) Tägliche Übersicht ──
  if (user.daily_overview) {
    // Senden um Fajr-Zeit (± 1 Minute Toleranz)
    const fajrMinutes = timeToMinutes(times.Fajr);
    if (Math.abs(currentMinutes - fajrMinutes) <= 1) {
      const alreadySent = await wasReminderSent(env, user.chat_id, "overview", today, "overview");
      if (!alreadySent) {
        await sendDailyOverview(env, user, times, today);
        await markReminderSent(env, user.chat_id, "overview", today, "overview");
      }
    }
  }

  // ── 2) Einzelne Erinnerungen ──
  for (const prayer of PRAYER_NAMES) {
    if (!user.reminders[prayer]) continue;

    const prayerMinutes = timeToMinutes(times[prayer]);
    const reminderMinutes = prayerMinutes - user.reminder_minutes;
    const diff = currentMinutes - reminderMinutes;

    // Innerhalb einer 2-Minuten-Toleranz (falls Cron mal eine Minute verpasst)
    if (diff >= 0 && diff <= 2) {
      const alreadySent = await wasReminderSent(env, user.chat_id, prayer, today, "reminder");
      if (!alreadySent) {
        await sendPrayerReminder(env, user, prayer, times[prayer]);
        await markReminderSent(env, user.chat_id, prayer, today, "reminder");
      }
    }
  }
}

// ── Tägliche Übersicht senden ──
async function sendDailyOverview(
  env: Env,
  user: UserSettings,
  times: Awaited<ReturnType<typeof getPrayerTimes>>,
  today: string
): Promise<void> {
  const dateFormatted = new Date(today).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let hijri = "";
  try {
    hijri = await getHijriDate(user.city, user.country);
  } catch { /* ignore */ }

  let text = `📋 <b>Gebetszeiten für heute</b>\n`;
  text += `📍 ${user.city}\n`;
  text += `📅 ${dateFormatted}\n`;
  if (hijri) text += `🌙 ${hijri}\n`;
  text += `\n`;
  text += `${PRAYER_LABELS.Fajr}       ${times.Fajr}\n`;
  text += `☀️ Sunrise      ${times.Sunrise}\n`;
  text += `${PRAYER_LABELS.Dhuhr}     ${times.Dhuhr}\n`;
  text += `${PRAYER_LABELS.Asr}        ${times.Asr}\n`;
  text += `${PRAYER_LABELS.Maghrib}  ${times.Maghrib}\n`;
  text += `${PRAYER_LABELS.Isha}       ${times.Isha}\n`;
  text += `\n🤲 Möge Allah deine Gebete annehmen.`;

  await sendMessage(env, user.chat_id, text);
}

// ── Erinnerung vor einem Gebet senden ──
async function sendPrayerReminder(
  env: Env,
  user: UserSettings,
  prayer: PrayerName,
  time: string
): Promise<void> {
  const text =
    `⏰ <b>Gebetserinnerung</b>\n\n` +
    `${PRAYER_LABELS[prayer]} ist in <b>${user.reminder_minutes} Minuten</b>\n` +
    `🕐 Um ${time} Uhr\n\n` +
    `🤲 Bereite dich auf dein Gebet vor.`;

  await sendMessage(env, user.chat_id, text);
}
