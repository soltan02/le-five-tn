import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db.js";
import { getCaller } from "./_lib/session.js";
import { ok, badRequest, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond.js";

// Bundled to stay under Vercel Hobby's 12-serverless-function cap.
// action: 'add' | 'set-status'. Both owner-only.
type Action = "add" | "set-status";
const VALID_STATUS = ["active", "maintenance", "removed"];

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);
  if (caller.role !== "owner") return forbidden(res);

  const body = (req.body ?? {}) as {
    action?: Action;
    name?: string; players?: string; perSide?: number | string; price?: number | string;
    surface?: string; covered?: boolean; tint?: string;
    pitchId?: string; status?: string;
  };

  if (body.action === "add") {
    const pitch = await prisma.pitch.create({
      data: {
        name: body.name?.trim() || "Nouveau terrain",
        players: body.players || "5 vs 5",
        perSide: Number(body.perSide) || 5,
        price: Number(body.price) || 0,
        surface: body.surface || "Gazon synthétique",
        covered: !!body.covered,
        tint: body.tint || "#166b3c",
        image: null,
        status: "active",
      },
    });
    return ok(res, { pitch });
  }

  if (body.action === "set-status") {
    if (!body.pitchId || !body.status || !VALID_STATUS.includes(body.status)) return badRequest(res, "Requête invalide.");
    const pitch = await prisma.pitch.update({
      where: { id: body.pitchId },
      data: { status: body.status as "active" | "maintenance" | "removed" },
    });
    return ok(res, { pitch });
  }

  return badRequest(res, "action invalide.");
}
