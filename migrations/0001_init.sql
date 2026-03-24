-- ══════════════════════════════════════════════
--  Prayer Times Bot — D1 Schema
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  chat_id         INTEGER PRIMARY KEY,
  city            TEXT NOT NULL,
  country         TEXT NOT NULL,
  timezone        TEXT NOT NULL DEFAULT 'Europe/Berlin',
  reminder_minutes INTEGER NOT NULL DEFAULT 15,
  daily_overview  INTEGER NOT NULL DEFAULT 1,   -- 0/1 (Boolean)
  reminder_fajr   INTEGER NOT NULL DEFAULT 1,
  reminder_dhuhr  INTEGER NOT NULL DEFAULT 1,
  reminder_asr    INTEGER NOT NULL DEFAULT 1,
  reminder_maghrib INTEGER NOT NULL DEFAULT 1,
  reminder_isha   INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sent_reminders (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id  INTEGER NOT NULL,
  prayer   TEXT NOT NULL,
  date     TEXT NOT NULL,          -- "YYYY-MM-DD"
  type     TEXT NOT NULL,          -- "reminder" | "overview"
  UNIQUE(chat_id, prayer, date, type)
);

-- Index für den Cron-Job (schneller Cleanup)
CREATE INDEX IF NOT EXISTS idx_sent_reminders_date ON sent_reminders(date);
