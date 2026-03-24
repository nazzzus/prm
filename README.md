# 🕌 Prayer Times Telegram Bot

Ein serverloser Telegram-Bot, der dir täglich Gebetszeiten schickt und dich vor jedem Gebet erinnert.

**Stack:** Cloudflare Workers + MongoDB Atlas + Aladhan API

---

## Features

- 📋 **Tägliche Übersicht** aller Gebetszeiten (inkl. Hijri-Datum)
- ⏰ **Erinnerungen** X Minuten vor jedem Gebet (konfigurierbar: 5/10/15/30 Min.)
- 🎛️ **Individuelle Steuerung** per Inline-Buttons — jedes Gebet einzeln ein-/ausschaltbar
- 📍 **Stadt änderbar** — Gebetszeiten passen sich automatisch an
- 🌍 **Weltweit** — jede Stadt, die die Aladhan API kennt
- ♻️ **Caching** — Gebetszeiten werden pro Stadt/Tag im KV Store gecached

---

## Setup-Anleitung

### 1. Voraussetzungen

- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare-Account](https://dash.cloudflare.com/sign-up) (kostenlos)
- [MongoDB Atlas-Account](https://www.mongodb.com/atlas) (kostenlos)
- Telegram-Account

### 2. Telegram Bot erstellen

1. Öffne [@BotFather](https://t.me/BotFather) in Telegram
2. Sende `/newbot` und folge den Anweisungen
3. Kopiere den **Bot Token** (Format: `123456:ABC-DEF...`)
4. Optional: Sende `/setcommands` und gib ein:
   ```
   start - Bot starten & Stadt setzen
   times - Heutige Gebetszeiten
   settings - Einstellungen anpassen
   help - Hilfe
   ```

### 3. MongoDB Atlas einrichten

1. Erstelle einen **kostenlosen Cluster** auf [MongoDB Atlas](https://cloud.mongodb.com)
2. Aktiviere die **Data API**:
   - Atlas Dashboard → `Data API` (linkes Menü)
   - Klicke "Enable Data API"
   - Erstelle einen **API Key** → kopiere ihn
   - Notiere die **App ID** (steht in der URL: `data-xxxxx`)
3. Notiere den **Cluster-Namen** (z.B. `Cluster0`)
4. Erstelle eine **Datenbank** namens `prayer_bot`

> ⚠️ Die Data API muss für deinen Cluster aktiviert sein!

### 4. Projekt klonen & Dependencies installieren

```bash
git clone <dein-repo>
cd prayer-times-bot
npm install
```

### 5. Cloudflare KV Namespace erstellen

```bash
npx wrangler kv namespace create PRAYER_CACHE
```

Kopiere die ausgegebene `id` in die `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "PRAYER_CACHE"
id = "HIER_DIE_ID_EINTRAGEN"
```

### 6. Secrets setzen

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# → Bot Token einfügen

npx wrangler secret put MONGODB_DATA_API_KEY
# → Atlas Data API Key einfügen

npx wrangler secret put MONGODB_APP_ID
# → Atlas App ID einfügen (z.B. data-xxxxx)

npx wrangler secret put MONGODB_CLUSTER_NAME
# → z.B. Cluster0

npx wrangler secret put MONGODB_DATABASE_NAME
# → z.B. prayer_bot
```

### 7. Deployen

```bash
npm run deploy
```

### 8. Webhook registrieren

Öffne diese URL einmal im Browser:

```
https://prayer-times-bot.<dein-subdomain>.workers.dev/setup
```

Du solltest `✅ Webhook gesetzt!` sehen.

### 9. Testen

Öffne deinen Bot in Telegram und sende `/start`!

---

## Bot-Befehle

| Befehl | Beschreibung |
|--------|-------------|
| `/start` | Bot starten, Stadt eingeben |
| `/times` | Heutige Gebetszeiten anzeigen |
| `/settings` | Einstellungen (Inline-Buttons) |
| `/help` | Hilfe anzeigen |

### Settings-Menü

Über `/settings` kannst du per Inline-Buttons:
- ✅/❌ Jedes Gebet einzeln ein-/ausschalten
- ✅/❌ Tägliche Übersicht an/aus
- ⏱ Erinnerungs-Zeitpunkt wählen (5/10/15/30 Min. vorher)
- 📍 Stadt ändern
- Alle Erinnerungen auf einmal an/aus

---

## Architektur

```
Telegram ──webhook──▶ Cloudflare Worker ──▶ MongoDB Atlas (User Settings)
                           │
                     Cron (jede Min.) ──▶ Aladhan API (Gebetszeiten)
                           │                    │
                           │              KV Cache (24h)
                           │
                     ◀── Telegram API (Nachrichten senden)
```

### Datenbank-Collections

**`users`** — User-Einstellungen:
```json
{
  "chat_id": 123456789,
  "city": "Berlin",
  "country": "Germany",
  "timezone": "Europe/Berlin",
  "reminder_minutes": 15,
  "daily_overview": true,
  "reminders": {
    "Fajr": true,
    "Dhuhr": true,
    "Asr": true,
    "Maghrib": true,
    "Isha": true
  }
}
```

**`sent_reminders`** — Tracking (verhindert doppelte Nachrichten):
```json
{
  "chat_id": 123456789,
  "prayer": "Fajr",
  "date": "2025-03-24",
  "type": "reminder"
}
```

---

## Entwicklung

```bash
# Lokal entwickeln (mit Tunnel zu Telegram)
npm run dev

# Logs ansehen
npm run tail
```

Für lokale Entwicklung brauchst du [ngrok](https://ngrok.com/) oder ähnliches, um Telegram-Webhooks zu empfangen:

```bash
ngrok http 8787
# Dann: https://deine-ngrok-url.ngrok.io/setup aufrufen
```

---

## Kosten

| Service | Free Tier |
|---------|-----------|
| Cloudflare Workers | 100.000 Requests/Tag |
| Cloudflare KV | 100.000 Reads/Tag, 1.000 Writes/Tag |
| MongoDB Atlas | 512 MB Storage, Shared Cluster |
| Aladhan API | Kostenlos, kein API Key nötig |

→ **Für hunderte User komplett kostenlos.**

---

## Erweiterungsideen

- 🧭 Qibla-Richtung senden
- 📖 Täglicher Quran-Vers
- 🗓️ Ramadan-Countdown
- 📊 Gebets-Tracking (hat der User gebetet?)
- 🌐 Berechnungsmethode wählbar (aktuell: Diyanet)
- 👥 Gruppen-Support

---

## Lizenz

MIT
