import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db.js";
import { getCaller } from "./_lib/session.js";
import { ok, badRequest, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond.js";

// Bundled to stay under Vercel Hobby's 12-serverless-function cap.
// action: 'add' (any session) | 'resolve' (owner-only).
type Action = "add" | "resolve";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);

  const body = (req.body ?? {}) as { action?: Action; text?: string; suggestionId?: string };

  if (body.action === "add") {
    if (!body.text?.trim()) return badRequest(res, "Texte manquant.");
    const suggestion = await prisma.suggestion.create({
      data: { phone: caller.phone, name: caller.name, text: body.text.trim() },
    });
    return ok(res, { suggestion });
  }

  if (body.action === "resolve") {
    if (caller.role !== "owner") return forbidden(res);
    if (!body.suggestionId) return badRequest(res, "suggestionId manquant.");
    const suggestion = await prisma.suggestion.update({ where: { id: body.suggestionId }, data: { status: "resolved" } });
    return ok(res, { suggestion });
  }

  return badRequest(res, "action invalide.");
}
