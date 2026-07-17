import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { getCaller } from "./_lib/session";
import { longDate } from "./_lib/dates";
import { ok, badRequest, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond";
import { FACILITY } from "../src/config/facility.js";

const validPhone = (p: string) => !!p && p.replace(/\D/g, "").length >= 8;

function confirmationText(name: string, pitchName: string, dayKey: string, slotStart: string): string {
  return `${FACILITY.name}: Bonjour ${name}, votre reservation ${pitchName} le ${longDate(dayKey)} a ${slotStart} est CONFIRMEE.`;
}

type Action = "confirm" | "cancel" | "decline";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);

  const { action, bookingId } = (req.body ?? {}) as { action?: Action; bookingId?: string };
  if (!bookingId || !action || !["confirm", "cancel", "decline"].includes(action)) {
    return badRequest(res, "Requête invalide.");
  }

  const target = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!target) return badRequest(res, "Réservation introuvable.");

  if (action === "confirm" || action === "decline") {
    if (caller.role !== "owner") return forbidden(res);
  } else if (action === "cancel") {
    if (caller.role !== "owner" && caller.phone !== target.phone) return forbidden(res);
  }

  if (action === "cancel") {
    const booking = await prisma.booking.update({ where: { id: bookingId }, data: { status: "cancelled" } });
    return ok(res, { booking });
  }

  if (action === "decline") {
    const booking = await prisma.booking.update({ where: { id: bookingId }, data: { status: "declined" } });
    return ok(res, { booking });
  }

  // action === "confirm" — grant this one, auto-decline every OTHER pending
  // request competing for the same date/pitch/slot.
  const [booking] = await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: "confirmed" } }),
    prisma.booking.updateMany({
      where: {
        id: { not: bookingId },
        dayKey: target.dayKey,
        pitchId: target.pitchId,
        slotStart: target.slotStart,
        status: "pending",
      },
      data: { status: "declined" },
    }),
  ]);

  if (validPhone(target.phone)) {
    const pitch = await prisma.pitch.findUnique({ where: { id: target.pitchId } });
    await prisma.smsOutbox.create({
      data: {
        toPhone: target.phone,
        body: confirmationText(target.name, pitch?.name || "", target.dayKey, target.slotStart),
        kind: "confirmation",
      },
    });
  }

  ok(res, { booking });
}
