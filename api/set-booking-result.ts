import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { getCaller } from "./_lib/session";
import { ok, badRequest, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond";

// Free-standing from `status` — the owner records, after the fact, whether a
// confirmed slot's match actually happened and how much was really collected
// (the pitch's listed price is a default, not always what changes hands).
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);
  if (caller.role !== "owner") return forbidden(res);

  const { bookingId, outcome, amountPaid } = (req.body ?? {}) as {
    bookingId?: string; outcome?: "played" | "cancelled"; amountPaid?: number | string | null;
  };
  if (!bookingId) return badRequest(res, "bookingId manquant.");
  if (outcome !== undefined && outcome !== null && !["played", "cancelled"].includes(outcome)) {
    return badRequest(res, "outcome invalide.");
  }

  const data: { outcome?: "played" | "cancelled"; amountPaid?: number | null } = {};
  if (outcome !== undefined) data.outcome = outcome;
  if (amountPaid !== undefined) {
    const n = Number(amountPaid);
    data.amountPaid = Number.isFinite(n) ? n : null;
  }

  const booking = await prisma.booking.update({ where: { id: bookingId }, data });
  ok(res, { booking });
}
