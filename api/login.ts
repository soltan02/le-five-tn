import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { normalizePhone, createSession } from "./_lib/session";
import { ok, badRequest, methodNotAllowed } from "./_lib/respond";

// Instant sign-up/sign-in — no verification code, matching the exact
// semantics of the client's old signIn(): phone becomes the account id,
// owner role is granted iff the phone matches OWNER_PHONE. The only real
// change from the old client-only version is that role is now decided and
// enforced here, not trusted from the browser.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const { phone, name } = (req.body ?? {}) as { phone?: string; name?: string };
  const clean = (phone || "").trim();
  const phoneNormalized = normalizePhone(clean);
  if (phoneNormalized.length < 8) return badRequest(res, "Numéro invalide.");

  const ownerNormalized = normalizePhone(process.env.OWNER_PHONE || "");

  let user = await prisma.user.findUnique({ where: { phoneNormalized } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: clean,
        phoneNormalized,
        name: name?.trim() || "Joueur",
        role: phoneNormalized === ownerNormalized ? "owner" : "player",
      },
    });
  } else if (name?.trim()) {
    user = await prisma.user.update({ where: { id: user.id }, data: { name: name.trim() } });
  }

  const { token, expiresAt } = await createSession(user.id);

  ok(res, { token, expiresAt, user: { phone: user.phone, name: user.name, role: user.role } });
}
