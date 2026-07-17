import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { getCaller } from "./_lib/session";
import { isPast, longDate } from "./_lib/dates";
import { ok, badRequest, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond";
import { FACILITY } from "../src/config/facility.js";

const validPhone = (p: string) => !!p && p.replace(/\D/g, "").length >= 8;

function confirmationText(name: string, pitchName: string, dayKey: string, slotStart: string): string {
  return `${FACILITY.name}: Bonjour ${name}, votre reservation ${pitchName} le ${longDate(dayKey)} a ${slotStart} est CONFIRMEE.`;
}

// Walk-in booking by the owner — goes straight to confirmed, bypasses the
// per-user active-booking limit, but still respects maintenance/past/
// already-confirmed and declines any competing pending requests for the slot.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);
  if (caller.role !== "owner") return forbidden(res);

  const { dayKey, pitchId, slotStart, slotEnd, name, phone } = (req.body ?? {}) as {
    dayKey?: string; pitchId?: string; slotStart?: string; slotEnd?: string; name?: string; phone?: string;
  };
  if (!dayKey || !pitchId || !slotStart || !slotEnd) return badRequest(res, "Champs manquants.");

  const pitch = await prisma.pitch.findUnique({ where: { id: pitchId } });
  if (!pitch || pitch.status === "removed") return badRequest(res, "Terrain indisponible.");
  if (pitch.status === "maintenance") return badRequest(res, "Terrain en maintenance.");
  if (isPast(dayKey, slotStart)) return badRequest(res, "Ce créneau est déjà passé.");

  const confirmed = await prisma.booking.findFirst({ where: { dayKey, pitchId, slotStart, status: "confirmed" } });
  if (confirmed) return badRequest(res, "Ce créneau est déjà réservé.");

  const bookingPhone = phone?.trim() || "—";
  const bookingName = name?.trim() || "Client";

  const [booking] = await prisma.$transaction([
    prisma.booking.create({
      data: {
        dayKey, pitchId, slotStart, slotEnd,
        phone: bookingPhone, name: bookingName,
        status: "confirmed", byOwner: true,
      },
    }),
    prisma.booking.updateMany({
      where: { dayKey, pitchId, slotStart, status: "pending" },
      data: { status: "declined" },
    }),
  ]);

  if (validPhone(bookingPhone)) {
    await prisma.smsOutbox.create({
      data: { toPhone: bookingPhone, body: confirmationText(bookingName, pitch.name, dayKey, slotStart), kind: "confirmation" },
    });
  }

  ok(res, { booking });
}
