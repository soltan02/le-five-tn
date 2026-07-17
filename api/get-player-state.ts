import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db.js";
import { getCaller } from "./_lib/session.js";
import { ok, unauthorized, methodNotAllowed } from "./_lib/respond.js";

// The caller's own bookings (any status/date — their full personal history,
// not windowed like get-schedule) plus their own suggestions.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);

  const [bookings, suggestions] = await Promise.all([
    prisma.booking.findMany({ where: { phone: caller.phone }, orderBy: [{ dayKey: "asc" }, { slotStart: "asc" }] }),
    prisma.suggestion.findMany({ where: { phone: caller.phone }, orderBy: { createdAt: "desc" } }),
  ]);

  ok(res, { bookings, suggestions });
}
