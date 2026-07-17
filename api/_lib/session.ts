import { createHash, randomBytes } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { prisma } from "./db.js";

const SESSION_DAYS = 30;

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface Caller {
  id: string;
  phone: string;
  name: string;
  role: "player" | "owner";
}

/** Reads the bearer token from the Authorization header and resolves the
 * caller, or null if missing/invalid/expired/revoked. Never throws. */
export async function getCaller(req: VercelRequest): Promise<Caller | null> {
  const header = req.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  const token = raw?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  return { id: session.user.id, phone: session.user.phone, name: session.user.name, role: session.user.role };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}
