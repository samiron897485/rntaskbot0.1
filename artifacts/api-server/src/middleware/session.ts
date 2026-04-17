import crypto from "crypto";

interface Session {
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function pruneExpired(): void {
  const now = Date.now();
  for (const [token, s] of sessions) {
    if (s.expiresAt < now) sessions.delete(token);
  }
}

export function createSession(): string {
  pruneExpired();
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  sessions.set(token, { createdAt: now, expiresAt: now + SESSION_TTL_MS });
  return token;
}

export function validateSession(token: string | undefined): boolean {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function destroySession(token: string | undefined): void {
  if (token) sessions.delete(token);
}

export function validateAdminCredentials(username: string, password: string): boolean {
  const adminUsername = process.env["ADMIN_USERNAME"] || "";
  const adminPassword = process.env["ADMIN_PASSWORD"] || "";
  if (!adminUsername || !adminPassword) return false;
  return username === adminUsername && password === adminPassword;
}
