import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db.js";
import { getCaller } from "./_lib/session.js";
import { upcomingDays } from "./_lib/dates.js";
import { ok, methodNotAllowed } from "./_lib/respond.js";

// Public (works logged-out) but role-aware: the owner sees full booker
// name/phone plus internal reconciliation fields (outcome/amountPaid) for
// every active booking; everyone else sees full detail ONLY on their own
// bookings — other players' active bookings still report their real
// `status` (so "taken"/"pending" renders correctly) but with name/phone AND
// the financial reconciliation fields stripped (a logged-out visitor has no
// business seeing how much money changed hands on a given slot). This is a
// real server-side enforcement of "players never see who booked or what was
// collected", not just the client choosing not to render it (which is all
// today's localStorage version does).
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") return methodNotAllowed(res);

  const caller = await getCaller(req);
  const daysParam = Number(req.query.days);
  const days = upcomingDays(Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 14);
  const dayKeys = days.map((d) => d.key);

  const [pitches, bookings] = await Promise.all([
    prisma.pitch.findMany({ where: { status: { not: "removed" } }, orderBy: { createdAt: "asc" } }),
    prisma.booking.findMany({
      where: { dayKey: { in: dayKeys }, status: { in: ["pending", "confirmed"] } },
    }),
  ]);

  const isOwner = caller?.role === "owner";
  const redacted = bookings.map((b) => {
    if (isOwner) return b;
    const isMine = !!caller && b.phone === caller.phone;
    if (isMine) return { ...b, outcome: null, amountPaid: null };
    return { ...b, name: "", phone: "", outcome: null, amountPaid: null };
  });

  ok(res, { days, pitches, bookings: redacted });
}
