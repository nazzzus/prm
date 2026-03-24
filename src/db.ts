import { Env, UserSettings, SentReminder } from "./types";

// ── Atlas Data API Base URL ──
function apiUrl(env: Env): string {
  return `https://data.mongodb-api.com/app/${env.MONGODB_APP_ID}/endpoint/data/v1`;
}

function headers(env: Env): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "api-key": env.MONGODB_DATA_API_KEY,
  };
}

function baseBody(env: Env, collection: string) {
  return {
    dataSource: env.MONGODB_CLUSTER_NAME,
    database: env.MONGODB_DATABASE_NAME,
    collection,
  };
}

// ── Generic CRUD Helpers ──

async function findOne<T>(env: Env, collection: string, filter: object): Promise<T | null> {
  const res = await fetch(`${apiUrl(env)}/action/findOne`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({ ...baseBody(env, collection), filter }),
  });
  const data = (await res.json()) as { document: T | null };
  return data.document;
}

async function findMany<T>(env: Env, collection: string, filter: object): Promise<T[]> {
  const res = await fetch(`${apiUrl(env)}/action/find`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({ ...baseBody(env, collection), filter }),
  });
  const data = (await res.json()) as { documents: T[] };
  return data.documents;
}

async function upsertOne(env: Env, collection: string, filter: object, update: object): Promise<void> {
  await fetch(`${apiUrl(env)}/action/updateOne`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({
      ...baseBody(env, collection),
      filter,
      update: { $set: update },
      upsert: true,
    }),
  });
}

async function insertOne(env: Env, collection: string, document: object): Promise<void> {
  await fetch(`${apiUrl(env)}/action/insertOne`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({ ...baseBody(env, collection), document }),
  });
}

// ── User Settings ──

export async function getUser(env: Env, chatId: number): Promise<UserSettings | null> {
  return findOne<UserSettings>(env, "users", { chat_id: chatId });
}

export async function getAllUsers(env: Env): Promise<UserSettings[]> {
  return findMany<UserSettings>(env, "users", {});
}

export async function saveUser(env: Env, user: Partial<UserSettings> & { chat_id: number }): Promise<void> {
  await upsertOne(env, "users", { chat_id: user.chat_id }, {
    ...user,
    updated_at: new Date().toISOString(),
  });
}

export async function createUser(env: Env, chatId: number, city: string, country: string, timezone: string): Promise<UserSettings> {
  const now = new Date().toISOString();
  const user: UserSettings = {
    chat_id: chatId,
    city,
    country,
    timezone,
    reminder_minutes: 15,
    daily_overview: true,
    reminders: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
    created_at: now,
    updated_at: now,
  };
  await upsertOne(env, "users", { chat_id: chatId }, user);
  return user;
}

// ── Sent Reminders Tracking ──

export async function wasReminderSent(
  env: Env,
  chatId: number,
  prayer: string,
  date: string,
  type: "reminder" | "overview"
): Promise<boolean> {
  const doc = await findOne<SentReminder>(env, "sent_reminders", {
    chat_id: chatId,
    prayer,
    date,
    type,
  });
  return doc !== null;
}

export async function markReminderSent(
  env: Env,
  chatId: number,
  prayer: string,
  date: string,
  type: "reminder" | "overview"
): Promise<void> {
  await insertOne(env, "sent_reminders", { chat_id: chatId, prayer, date, type });
}

// ── Cleanup: alte Einträge löschen (> 2 Tage) ──
export async function cleanupOldReminders(env: Env): Promise<void> {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const dateStr = twoDaysAgo.toISOString().split("T")[0];

  await fetch(`${apiUrl(env)}/action/deleteMany`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({
      ...baseBody(env, "sent_reminders"),
      filter: { date: { $lt: dateStr } },
    }),
  });
}
