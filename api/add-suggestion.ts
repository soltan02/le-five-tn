import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { getCaller } from "./_lib/session";
import { ok, badRequest, unauthorized, methodNotAllowed } from "./_lib/respond";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);

  const { text } = (req.body ?? {}) as { text?: string };
  if (!text?.trim()) return badRequest(res, "Texte manquant.");

  const suggestion = await prisma.suggestion.create({
    data: { phone: caller.phone, name: caller.name, text: text.trim() },
  });
  ok(res, { suggestion });
}
