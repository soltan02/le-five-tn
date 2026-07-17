import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { getCaller } from "./_lib/session";
import { ok, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);
  if (caller.role !== "owner") return forbidden(res);

  const body = (req.body ?? {}) as {
    name?: string; players?: string; perSide?: number | string; price?: number | string;
    surface?: string; covered?: boolean; tint?: string;
  };

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

  ok(res, { pitch });
}
