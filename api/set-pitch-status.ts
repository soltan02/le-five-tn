import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { getCaller } from "./_lib/session";
import { ok, badRequest, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond";

const VALID = ["active", "maintenance", "removed"];

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);
  if (caller.role !== "owner") return forbidden(res);

  const { pitchId, status } = (req.body ?? {}) as { pitchId?: string; status?: string };
  if (!pitchId || !status || !VALID.includes(status)) return badRequest(res, "Requête invalide.");

  const pitch = await prisma.pitch.update({ where: { id: pitchId }, data: { status: status as "active" | "maintenance" | "removed" } });
  ok(res, { pitch });
}
