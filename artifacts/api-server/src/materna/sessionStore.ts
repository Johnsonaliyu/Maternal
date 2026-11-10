import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UserSession } from "./types";

const storePath = path.resolve(
  process.env.MATERNA_SESSION_FILE ?? "data/materna-sessions.json",
);

const sessions = new Map<string, UserSession>();
let loaded = false;
let writeQueue = Promise.resolve();

async function loadStore() {
  if (loaded) return;
  loaded = true;

  try {
    const contents = await readFile(storePath, "utf8");
    const saved = JSON.parse(contents) as Record<string, UserSession>;
    for (const [phoneNumber, session] of Object.entries(saved)) {
      sessions.set(phoneNumber, session);
    }
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : "";
    if (code !== "ENOENT") throw error;
  }
}

function persist() {
  writeQueue = writeQueue.then(async () => {
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeFile(
      storePath,
      JSON.stringify(Object.fromEntries(sessions), null, 2),
      "utf8",
    );
  });
  return writeQueue;
}

export async function getSession(phoneNumber: string) {
  await loadStore();
  return sessions.get(phoneNumber);
}

export async function getOrCreateSession(phoneNumber: string) {
  await loadStore();
  const existing = sessions.get(phoneNumber);
  if (existing) return existing;

  const now = new Date().toISOString();
  const session: UserSession = {
    phoneNumber,
    language: "en",
    stage: "awaiting_name",
    consentAccepted: false,
    medicalHistory: [],
    chatHistory: [],
    createdAt: now,
    updatedAt: now,
  };
  sessions.set(phoneNumber, session);
  await persist();
  return session;
}

export async function saveSession(session: UserSession) {
  await loadStore();
  session.updatedAt = new Date().toISOString();
  sessions.set(session.phoneNumber, session);
  await persist();
  return session;
}

export async function countSessions() {
  await loadStore();
  return sessions.size;
}

export async function listSessions() {
  await loadStore();
  return [...sessions.values()];
}