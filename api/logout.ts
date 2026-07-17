import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { hashToken } from "./_lib/session";
import { ok, methodNotAllowed } from "./_lib/respond";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const header = req.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  const token = raw?.replace(/^Bearer\s+/i, "").trim();
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  ok(res, {});
}
