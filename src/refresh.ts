import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

type RefreshSession = {
  userId: string;
  tokenHash: string;
  expiresAt: number;
};

const FILE = "./sessions.json";

export const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

async function getSessions(): Promise<RefreshSession[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];

    throw error;
  }
}

async function saveSessions(sessions: RefreshSession[]) {
  await writeFile(FILE, JSON.stringify(sessions, null, 2));
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createRefreshToken(userId: string) {
  const token = randomBytes(32).toString("hex");
  const sessions = await getSessions();

  sessions.push({
    userId,
    tokenHash: hashToken(token),
    expiresAt: Date.now() + SEVEN_DAYS,
  });

  await saveSessions(sessions);
  return token;
}

export async function rotateRefreshToken(oldToken: string) {
  const sessions = await getSessions();
  const index = sessions.findIndex((s) => s.tokenHash === hashToken(oldToken));

  if (index === -1 || sessions[index]!.expiresAt < Date.now()) {
    return null;
  }

  const userId = sessions[index]!.userId;
  const newToken = randomBytes(32).toString("hex");

  sessions[index] = {
    userId,
    tokenHash: hashToken(newToken),
    expiresAt: Date.now() + SEVEN_DAYS,
  };

  await saveSessions(sessions);

  return { userId, token: newToken };
}

export async function revokeRefreshToken(token: string) {
  const sessions = await getSessions();

  const remainingSessions = sessions.filter(
    (session) => session.tokenHash !== hashToken(token),
  );

  await saveSessions(remainingSessions);
}
