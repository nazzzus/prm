import { Env, UserSettings, PRAYER_NAMES, PRAYER_LABELS, PrayerName, userReminders, reminderColumn } from "./types";
import { getUser, createUser, updateCity, updateReminderMinutes, updateDailyOverview, togglePrayerReminder, setAllReminders } from "./db";
import { getPrayerTimes, getHijriDate } from "./prayers";
import { sendMessage, editMessage, answerCallback } from "./telegram";
import { sanitizeCityInput, canRegisterNewUser, incrementUserCount, isAdmin, banUser, unbanUser } from "./security";

// ══════════════════════════════════════════════
//  COMMAND HANDLERS
// ══════════════════════════════════════════════

export async function handleStart(env: Env, chatId: number, firstName?: string): Promise<void> {
  const user = await getUser(env, chatId);

  if (user) {
    await sendMessage(env, chatId,
      `Willkommen zurück, ${firstName ?? ""}! 🤲\n\n` +
      `Deine Stadt: <b>${user.city}, ${user.country}</b>\n\n` +
      `Nutze /times für die heutigen Gebetszeiten\n` +
      `oder /settings um deine Einstellungen zu ändern.`
    );
    return;
  }

  await sendMessage(env, chatId,
    `Assalamu Alaikum, ${firstName ?? ""}! 🤲\n\n` +
    `Ich bin dein Gebetszeiten-Bot. Ich schicke dir:\n` +
    `• Jeden Tag eine Übersicht aller Gebetszeiten\n` +
    `• Erinnerungen kurz vor jedem Gebet\n\n` +
    `<b>Lass uns starten!</b>\n` +
    `Bitte schreib mir deine Stadt und dein Land, z.B.:\n\n` +
    `<code>Berlin, Germany</code>\n` +
    `<code>Istanbul, Turkey</code>\n` +
    `<code>Wien, Austria</code>`
  );
}

export async function handleSetCity(env: Env, chatId: number, text: string): Promise<void> {
  // 🔒 Input validieren & sanitizen
  const input = sanitizeCityInput(text);
  if (!input.valid || !input.city || !input.country) {
    await sendMessage(env, chatId,
      `❌ ${input.error ?? "Ungültige Eingabe."}\n\nBitte schreib Stadt und Land im Format:\n<code>Berlin, Germany</code>`
    );
    return;
  }

  const { city, country } = input;

  // Prüfe ob User schon existiert
  const existingUser = await getUser(env, chatId);
  if (!existingUser) {
    const canRegister = await canRegisterNewUser(env);
    if (!canRegister) {
      await sendMessage(env, chatId,
        `❌ Der Bot hat aktuell die maximale Nutzerzahl erreicht.\nBitte versuche es später erneut.`
      );
      return;
    }
  }

  // Testen ob die API was findet
  try {
    const times = await getPrayerTimes(env, city, country);
    if (!times.Fajr) throw new Error("Keine Zeiten");
  } catch {
    await sendMessage(env, chatId,
      `❌ Konnte keine Gebetszeiten für <b>${city}, ${country}</b> finden.\n` +
      `Bitte prüfe die Schreibweise und versuche es erneut.`
    );
    return;
  }

  const timezone = await detectTimezone(city, country);

  if (existingUser) {
    await updateCity(env, chatId, city, country, timezone);
    await sendMessage(env, chatId,
      `✅ Stadt geändert zu <b>${city}, ${country}</b>!\n\nNutze /times um die Gebetszeiten zu sehen.`
    );
  } else {
    await createUser(env, chatId, city, country, timezone);
    await incrementUserCount(env);
    await sendMessage(env, chatId,
      `✅ Perfekt! Du bist eingerichtet für <b>${city}, ${country}</b>.\n\n` +
      `Ab jetzt bekommst du:\n` +
      `• 📋 Tägliche Gebetszeiten-Übersicht\n` +
      `• ⏰ Erinnerungen 15 Min. vor jedem Gebet\n\n` +
      `Befehle:\n` +
      `/times – Heutige Gebetszeiten\n` +
      `/settings – Einstellungen anpassen\n` +
      `/help – Hilfe`
    );
  }
}

async function detectTimezone(city: string, country: string): Promise<string> {
  const now = new Date();
  const dd = now.getDate();
  const mm = now.getMonth() + 1;
  const yyyy = now.getFullYear();
  const url = `https://api.aladhan.com/v1/timingsByCity/${dd}-${mm}-${yyyy}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=13`;
  const res = await fetch(url);
  const json = (await res.json()) as any;
  return json?.data?.meta?.timezone ?? "Europe/Berlin";
}

export async function handleTimes(env: Env, chatId: number): Promise<void> {
  const user = await getUser(env, chatId);
  if (!user) {
    await sendMessage(env, chatId, `Du bist noch nicht eingerichtet. Nutze /start um loszulegen.`);
    return;
  }

  const times = await getPrayerTimes(env, user.city, user.country);
  let hijri: string;
  try {
    hijri = await getHijriDate(user.city, user.country);
  } catch {
    hijri = "";
  }

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: user.timezone,
  });

  let text = `🕌 <b>Gebetszeiten für ${user.city}</b>\n`;
  text += `📅 ${today}\n`;
  if (hijri) text += `🌙 ${hijri}\n`;
  text += `\n`;
  text += `${PRAYER_LABELS.Fajr}       ${times.Fajr}\n`;
  text += `☀️ Sunrise      ${times.Sunrise}\n`;
  text += `${PRAYER_LABELS.Dhuhr}     ${times.Dhuhr}\n`;
  text += `${PRAYER_LABELS.Asr}        ${times.Asr}\n`;
  text += `${PRAYER_LABELS.Maghrib}  ${times.Maghrib}\n`;
  text += `${PRAYER_LABELS.Isha}       ${times.Isha}\n`;

  await sendMessage(env, chatId, text);
}

export async function handleHelp(env: Env, chatId: number): Promise<void> {
  await sendMessage(env, chatId,
    `🤲 <b>Gebetszeiten-Bot — Hilfe</b>\n\n` +
    `/start – Bot starten & Stadt setzen\n` +
    `/times – Heutige Gebetszeiten\n` +
    `/settings – Einstellungen anpassen\n` +
    `/help – Diese Hilfe\n\n` +
    `<b>Stadt ändern:</b>\n` +
    `Schreib einfach die neue Stadt, z.B.:\n` +
    `<code>München, Germany</code>\n\n` +
    `<b>Erinnerungen:</b>\n` +
    `Über /settings kannst du für jedes Gebet\n` +
    `einzeln ein-/ausschalten, ob du erinnert wirst.`
  );
}

// ══════════════════════════════════════════════
//  SETTINGS MENU (Inline-Buttons)
// ══════════════════════════════════════════════

export async function handleSettings(env: Env, chatId: number): Promise<void> {
  const user = await getUser(env, chatId);
  if (!user) {
    await sendMessage(env, chatId, `Du bist noch nicht eingerichtet. Nutze /start um loszulegen.`);
    return;
  }
  await sendSettingsMenu(env, chatId, user);
}

async function sendSettingsMenu(env: Env, chatId: number, user: UserSettings, editMessageId?: number): Promise<void> {
  const on = "✅";
  const off = "❌";
  const reminders = userReminders(user);

  const text =
    `⚙️ <b>Einstellungen</b>\n\n` +
    `📍 Stadt: <b>${user.city}, ${user.country}</b>\n` +
    `⏱ Erinnerung: <b>${user.reminder_minutes} Min. vorher</b>\n` +
    `📋 Tägliche Übersicht: ${user.daily_overview ? on : off}\n\n` +
    `<b>Erinnerungen pro Gebet:</b>\n` +
    PRAYER_NAMES.map((p) => `${PRAYER_LABELS[p]}: ${reminders[p] ? on : off}`).join("\n");

  const keyboard = {
    inline_keyboard: [
      PRAYER_NAMES.map((p) => ({
        text: `${reminders[p] ? on : off} ${p}`,
        callback_data: `toggle_prayer:${p}`,
      })),
      [{
        text: `${user.daily_overview ? on : off} Tägliche Übersicht`,
        callback_data: "toggle_overview",
      }],
      [
        { text: "5 Min", callback_data: "set_minutes:5" },
        { text: "10 Min", callback_data: "set_minutes:10" },
        { text: "15 Min", callback_data: "set_minutes:15" },
        { text: "30 Min", callback_data: "set_minutes:30" },
      ],
      [
        { text: "✅ Alle an", callback_data: "all_on" },
        { text: "❌ Alle aus", callback_data: "all_off" },
      ],
      [{ text: "📍 Stadt ändern", callback_data: "change_city" }],
    ],
  };

  if (editMessageId) {
    await editMessage(env, chatId, editMessageId, text, keyboard);
  } else {
    await sendMessage(env, chatId, text, { reply_markup: keyboard });
  }
}

// ══════════════════════════════════════════════
//  CALLBACK QUERY HANDLER
// ══════════════════════════════════════════════

export async function handleCallback(
  env: Env,
  callbackId: string,
  chatId: number,
  messageId: number,
  data: string
): Promise<void> {
  const user = await getUser(env, chatId);
  if (!user) {
    await answerCallback(env, callbackId, "Bitte erst /start nutzen.");
    return;
  }

  // ── Toggle einzelnes Gebet ──
  if (data.startsWith("toggle_prayer:")) {
    const prayer = data.split(":")[1] as PrayerName;
    const newVal = await togglePrayerReminder(env, chatId, prayer);
    await answerCallback(env, callbackId, `${prayer}: ${newVal ? "An ✅" : "Aus ❌"}`);
    const updated = await getUser(env, chatId);
    if (updated) await sendSettingsMenu(env, chatId, updated, messageId);
    return;
  }

  // ── Toggle tägliche Übersicht ──
  if (data === "toggle_overview") {
    const newVal = !user.daily_overview;
    await updateDailyOverview(env, chatId, newVal);
    await answerCallback(env, callbackId, `Übersicht: ${newVal ? "An ✅" : "Aus ❌"}`);
    const updated = await getUser(env, chatId);
    if (updated) await sendSettingsMenu(env, chatId, updated, messageId);
    return;
  }

  // ── Minuten setzen ──
  if (data.startsWith("set_minutes:")) {
    const mins = parseInt(data.split(":")[1], 10);
    await updateReminderMinutes(env, chatId, mins);
    await answerCallback(env, callbackId, `Erinnerung: ${mins} Min. vorher`);
    const updated = await getUser(env, chatId);
    if (updated) await sendSettingsMenu(env, chatId, updated, messageId);
    return;
  }

  // ── Alle an/aus ──
  if (data === "all_on" || data === "all_off") {
    const value = data === "all_on";
    await setAllReminders(env, chatId, value);
    await answerCallback(env, callbackId, value ? "Alle an ✅" : "Alle aus ❌");
    const updated = await getUser(env, chatId);
    if (updated) await sendSettingsMenu(env, chatId, updated, messageId);
    return;
  }

  // ── Stadt ändern ──
  if (data === "change_city") {
    await answerCallback(env, callbackId);
    await sendMessage(env, chatId, `📍 Schreib mir deine neue Stadt und Land:\n<code>Hamburg, Germany</code>`);
    return;
  }

  await answerCallback(env, callbackId);
}

// ══════════════════════════════════════════════
//  ADMIN COMMANDS
// ══════════════════════════════════════════════

export async function handleAdmin(env: Env, chatId: number, text: string): Promise<void> {
  if (!isAdmin(chatId, env)) {
    await sendMessage(env, chatId, "⛔ Kein Zugriff.");
    return;
  }

  const parts = text.split(/\s+/);
  const subCommand = parts[1];
  const targetId = parts[2] ? parseInt(parts[2], 10) : null;

  switch (subCommand) {
    case "ban":
      if (!targetId) { await sendMessage(env, chatId, "Usage: <code>/admin ban CHAT_ID</code>"); return; }
      await banUser(env, targetId);
      await sendMessage(env, chatId, `🔨 User ${targetId} gebannt.`);
      return;

    case "unban":
      if (!targetId) { await sendMessage(env, chatId, "Usage: <code>/admin unban CHAT_ID</code>"); return; }
      await unbanUser(env, targetId);
      await sendMessage(env, chatId, `✅ User ${targetId} entbannt.`);
      return;

    case "stats": {
      const countStr = await env.PRAYER_CACHE.get("user_count");
      await sendMessage(env, chatId,
        `📊 <b>Bot-Statistiken</b>\n\n👥 Registrierte User: ${countStr ?? "0"}`
      );
      return;
    }

    default:
      await sendMessage(env, chatId,
        `🔧 <b>Admin-Befehle</b>\n\n` +
        `<code>/admin ban CHAT_ID</code> – User bannen\n` +
        `<code>/admin unban CHAT_ID</code> – User entbannen\n` +
        `<code>/admin stats</code> – Statistiken`
      );
  }
}
