import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db.js";
import { normalizePhone, createSession, hashToken } from "./_lib/session.js";
import { ok, badRequest, methodNotAllowed } from "./_lib/respond.js";

// Bundled to stay under Vercel Hobby's 12-serverless-function cap (see
// api/bookings.ts for the same pattern). action: 'login' | 'logout'.
type Body = { action?: "login" | "logout"; phone?: string; name?: string };

async function login(req: VercelRequest, res: VercelResponse, body: Body): Promise<void> {
  // Instant sign-up/sign-in — no verification code, matching the exact
  // semantics of the client's old signIn(): phone becomes the account id,
  // owner role is granted iff the phone matches OWNER_PHONE. The only real
  // change from the old client-only version is that role is now decided and
  // enforced here, not trusted from the browser.
  const clean = (body.phone || "").trim();
  const phoneNormalized = normalizePhone(clean);
  if (phoneNormalized.length < 8) return badRequest(res, "Numéro invalide.");

  const ownerNormalized = normalizePhone(process.env.OWNER_PHONE || "");

  let user = await prisma.user.findUnique({ where: { phoneNormalized } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: clean,
        phoneNormalized,
        name: body.name?.trim() || "Joueur",
        role: phoneNormalized === ownerNormalized ? "owner" : "player",
      },
    });
  } else if (body.name?.trim()) {
    user = await prisma.user.update({ where: { id: user.id }, data: { name: body.name.trim() } });
  }

  const { token, expiresAt } = await createSession(user.id);
  ok(res, { token, expiresAt, user: { phone: user.phone, name: user.name, role: user.role } });
}

async function logout(req: VercelRequest, res: VercelResponse): Promise<void> {
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);
  const body = (req.body ?? {}) as Body;

  if (body.action === "logout") return logout(req, res);
  if (body.action === "login") return login(req, res, body);
  return badRequest(res, "action invalide.");
}
