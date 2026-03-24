import { Env, PrayerTimes, CachedPrayerData } from "./types";

const ALADHAN_BASE = "https://api.aladhan.com/v1";

interface AladhanResponse {
  code: number;
  data: {
    timings: Record<string, string>;
    date: {
      readable: string;
      hijri: { day: string; month: { en: string; ar: string }; year: string };
      gregorian: { date: string };
    };
    meta: { timezone: string };
  };
}

/**
 * Gebetszeiten für eine Stadt an einem bestimmten Datum holen.
 * Nutzt KV Cache um API-Calls zu minimieren.
 */
export async function getPrayerTimes(
  env: Env,
  city: string,
  country: string,
  date?: Date
): Promise<PrayerTimes> {
  const d = date ?? new Date();
  const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
  const cacheKey = `prayers:${city}:${country}:${dateStr}`;

  // 1) Cache prüfen
  const cached = await env.PRAYER_CACHE.get(cacheKey, "json") as CachedPrayerData | null;
  if (cached) {
    return cached.times;
  }

  // 2) Aladhan API anfragen
  const dd = d.getDate();
  const mm = d.getMonth() + 1;
  const yyyy = d.getFullYear();

  const url = `${ALADHAN_BASE}/timingsByCity/${dd}-${mm}-${yyyy}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=13`;
  // method=13 = Diyanet (Turkey) — beliebt in DACH. User kann das ggf. umstellen.

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Aladhan API Fehler: ${res.status}`);
  }

  const json = (await res.json()) as AladhanResponse;
  const t = json.data.timings;

  // Nur " (CEST)" etc. aus den Zeiten entfernen
  const clean = (s: string) => s.replace(/\s*\(.*\)/, "");

  const times: PrayerTimes = {
    Fajr: clean(t.Fajr),
    Sunrise: clean(t.Sunrise),
    Dhuhr: clean(t.Dhuhr),
    Asr: clean(t.Asr),
    Maghrib: clean(t.Maghrib),
    Isha: clean(t.Isha),
  };

  // 3) Cache speichern (TTL: bis Mitternacht + Puffer)
  await env.PRAYER_CACHE.put(cacheKey, JSON.stringify({ times, date: dateStr }), {
    expirationTtl: 86400, // 24h
  });

  return times;
}

/**
 * Hijri-Datum holen (für die tägliche Übersicht)
 */
export async function getHijriDate(city: string, country: string): Promise<string> {
  const now = new Date();
  const dd = now.getDate();
  const mm = now.getMonth() + 1;
  const yyyy = now.getFullYear();

  const url = `${ALADHAN_BASE}/timingsByCity/${dd}-${mm}-${yyyy}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=13`;
  const res = await fetch(url);
  const json = (await res.json()) as AladhanResponse;
  const h = json.data.date.hijri;
  return `${h.day}. ${h.month.ar} (${h.month.en}) ${h.year} AH`;
}

/**
 * Konvertiert "HH:MM" String zu Minuten seit Mitternacht
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Aktuelle Uhrzeit in einer Zeitzone als "HH:MM" und Minuten
 */
export function getCurrentTime(timezone: string): { timeStr: string; minutes: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("de-DE", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const timeStr = formatter.format(now).replace(",", "").trim();
  return { timeStr, minutes: timeToMinutes(timeStr) };
}

/**
 * Heutiges Datum in einer Zeitzone als "YYYY-MM-DD"
 */
export function getTodayDate(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now); // "YYYY-MM-DD"
}
