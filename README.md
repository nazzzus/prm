# 🕌 Prayer Times Telegram Bot

Ein serverloser Telegram-Bot, der dir täglich Gebetszeiten schickt und dich vor jedem Gebet erinnert.

**Stack:** Cloudflare Workers + D1 (SQL) + KV Cache + Aladhan API

---

## Features

- 📋 **Tägliche Übersicht** aller Gebetszeiten (inkl. Hijri-Datum)
- ⏰ **Erinnerungen** X Minuten vor jedem Gebet (konfigurierbar: 5/10/15/30 Min.)
- 🎛️ **Individuelle Steuerung** per Inline-Buttons — jedes Gebet einzeln ein-/ausschaltbar
- 📍 **Stadt änderbar** — Gebetszeiten passen sich automatisch an
- 🔒 **Abgesichert** — Webhook Secret, Rate Limiting, Input Validation, Ban-System
- ♻️ **Caching** — Gebetszeiten werden pro Stadt/Tag im KV Store gecached

---

## Setup-Anleitung

### 1. Voraussetzungen

- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare-Account](https://dash.cloudflare.com/sign-up) (kostenlos, E-Mail verifiziert!)

### 2. Telegram Bot erstellen

1. Öffne [@BotFather](https://t.me/BotFather) in Telegram
2. Sende `/newbot` und folge den Anweisungen
3. Kopiere den **Bot Token** (Format: `123456:ABC-DEF...`)
4. Optional: Sende `/setcommands` an BotFather:
   ```
   start - Bot starten und Stadt setzen
   times - Heutige Gebetszeiten
   settings - Einstellungen anpassen
   help - Hilfe
   ```

### 3. Deine Telegram Chat-ID herausfinden

Öffne [@userinfobot](https://t.me/userinfobot) in Telegram und sende `/start`.
Notiere die angezeigte Zahl — das ist deine Chat-ID.

### 4. Dependencies installieren

```bash
npm install
```

### 5. Bei Cloudflare anmelden

```bash
npx wrangler login
```

### 6. KV Namespace erstellen

```bash
npx wrangler kv namespace create PRAYER_CACHE
```

Kopiere die `id` aus der Ausgabe in `wrangler.toml` → ersetze `YOUR_KV_NAMESPACE_ID`.

### 7. D1 Datenbank erstellen

```bash
npx wrangler d1 create prayer-bot-db
```

Kopiere die `database_id` aus der Ausgabe in `wrangler.toml` → ersetze `YOUR_D1_DATABASE_ID`.

Dann die Tabellen anlegen:

```bash
npx wrangler d1 execute prayer-bot-db --remote --file=migrations/0001_init.sql
```

### 8. Webhook Secret generieren

```bash
openssl rand -hex 32
```

Kopiere den Output — das ist dein Webhook Secret.

### 9. Secrets setzen

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# → Bot Token von BotFather einfügen

npx wrangler secret put WEBHOOK_SECRET
# → den generierten Hex-String einfügen

npx wrangler secret put ADMIN_CHAT_ID
# → deine Chat-ID einfügen
```

### 10. Deployen

```bash
npm run deploy
```

### 11. Webhook registrieren

Öffne einmal im Browser (ersetze die Werte):

```
https://prayer-times-bot.DEIN-NAME.workers.dev/setup?token=DEIN_WEBHOOK_SECRET
```

Du solltest `✅ Webhook gesetzt!` sehen.

### 12. Testen!

Öffne deinen Bot in Telegram und sende `/start` 🎉

---

## Bot-Befehle

| Befehl | Beschreibung |
|--------|-------------|
| `/start` | Bot starten, Stadt eingeben |
| `/times` | Heutige Gebetszeiten anzeigen |
| `/settings` | Einstellungen (Inline-Buttons) |
| `/help` | Hilfe anzeigen |

### Admin-Befehle (nur für dich)

| Befehl | Beschreibung |
|--------|-------------|
| `/admin ban CHAT_ID` | User sperren |
| `/admin unban CHAT_ID` | User entsperren |
| `/admin stats` | User-Statistiken |

---

## Sicherheit

| Schutz | Details |
|--------|---------|
| Webhook Secret | Telegram sendet Secret-Header, alles andere → 403 |
| Rate Limiting | Max 10 Nachrichten/Min pro User, 5 Min Sperre |
| Input Validation | Regex-Whitelist, Max 100 Zeichen für Städte |
| Ban System | Permanente Bans über `/admin ban` |
| Max Users Cap | Limit bei 500 (anpassbar in `security.ts`) |
| Setup-Schutz | `/setup` nur mit Token aufrufbar |

---

## Architektur

```
Telegram ──webhook──▶ Cloudflare Worker ──▶ D1 (User Settings)
                           │                    KV (Cache + Rate Limits)
                     Cron (jede Min.) ──▶ Aladhan API (Gebetszeiten)
                           │
                     ◀── Telegram API (Nachrichten senden)
```

---

## Kosten

| Service | Free Tier |
|---------|-----------|
| Cloudflare Workers | 100.000 Requests/Tag |
| Cloudflare D1 | 5 Mio Reads/Tag, 100k Writes/Tag |
| Cloudflare KV | 100.000 Reads/Tag, 1.000 Writes/Tag |
| Aladhan API | Kostenlos, kein API Key nötig |

→ **Für hunderte User komplett kostenlos.**

---

## Erweiterungsideen

- 🧭 Qibla-Richtung senden
- 📖 Täglicher Quran-Vers
- 🗓️ Ramadan-Countdown
- 📊 Gebets-Tracking
- 🌐 Berechnungsmethode wählbar (aktuell: Diyanet)

---

## Lizenz

MIT
