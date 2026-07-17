import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { getCaller } from "./_lib/session";
import { isPast } from "./_lib/dates";
import { ok, badRequest, unauthorized, methodNotAllowed } from "./_lib/respond";
import { FACILITY } from "../src/config/facility.js";

// Mirrors the old client-only createBooking(): multiple players may request
// the same free slot (they stack, the owner picks one) — only a duplicate
// request from the SAME phone is blocked, plus the per-user active-booking
// limit and the maintenance/past/already-confirmed checks.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);

  const { dayKey, pitchId, slotStart, slotEnd } = (req.body ?? {}) as {
    dayKey?: string; pitchId?: string; slotStart?: string; slotEnd?: string;
  };
  if (!dayKey || !pitchId || !slotStart || !slotEnd) return badRequest(res, "Champs manquants.");

  const pitch = await prisma.pitch.findUnique({ where: { id: pitchId } });
  if (!pitch || pitch.status === "removed") return badRequest(res, "Terrain indisponible.");
  if (pitch.status === "maintenance") return badRequest(res, "Terrain en maintenance.");
  if (isPast(dayKey, slotStart)) return badRequest(res, "Ce créneau est déjà passé.");

  const confirmed = await prisma.booking.findFirst({ where: { dayKey, pitchId, slotStart, status: "confirmed" } });
  if (confirmed) return badRequest(res, "Ce créneau est déjà réservé.");

  const myPending = await prisma.booking.findFirst({
    where: { dayKey, pitchId, slotStart, status: "pending", phone: caller.phone },
  });
  if (myPending) return badRequest(res, "Tu as déjà demandé ce créneau.");

  const activeCount = await prisma.booking.count({
    where: { phone: caller.phone, status: { in: ["pending", "confirmed"] } },
  });
  // isPast filtering happens app-side in the old code too (active bookings
  // that are already past don't count) — replicate by excluding past ones.
  const activeBookings = await prisma.booking.findMany({
    where: { phone: caller.phone, status: { in: ["pending", "confirmed"] } },
    select: { dayKey: true, slotStart: true },
  });
  const activeNotPast = activeBookings.filter((b) => !isPast(b.dayKey, b.slotStart)).length;
  void activeCount;
  if (activeNotPast >= FACILITY.maxActiveBookingsPerUser) {
    return badRequest(res, `Limite de ${FACILITY.maxActiveBookingsPerUser} réservations actives atteinte.`);
  }

  const booking = await prisma.booking.create({
    data: { dayKey, pitchId, slotStart, slotEnd, phone: caller.phone, name: caller.name, status: "pending" },
  });

  const competing = await prisma.booking.count({ where: { dayKey, pitchId, slotStart, status: "pending" } });
  await prisma.notification.create({
    data: {
      text: `Nouvelle demande — ${caller.name} · ${pitch.name} · ${slotStart}` + (competing > 1 ? ` (${competing} demandes sur ce créneau)` : ""),
      type: "booking",
      bookingId: booking.id,
    },
  });

  ok(res, { booking });
}
