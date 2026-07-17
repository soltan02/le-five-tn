import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db.js";
import { getCaller, Caller } from "./_lib/session.js";
import { isPast, longDate } from "./_lib/dates.js";
import { ok, badRequest, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond.js";
import { FACILITY } from "../src/config/facility.js";

// Bundled to stay under Vercel Hobby's 12-serverless-function cap. Every
// booking state transition lives here, routed by `action`.
type Action = "create" | "owner-create" | "confirm" | "cancel" | "decline" | "set-result";

const validPhone = (p: string) => !!p && p.replace(/\D/g, "").length >= 8;

function confirmationText(name: string, pitchName: string, dayKey: string, slotStart: string): string {
  return `${FACILITY.name}: Bonjour ${name}, votre reservation ${pitchName} le ${longDate(dayKey)} a ${slotStart} est CONFIRMEE.`;
}

// Player: request a slot. Multiple players may request the same free slot
// (they stack, the owner picks one) — only a duplicate request from the SAME
// phone is blocked, plus the per-user active-booking limit and the
// maintenance/past/already-confirmed checks.
async function create(res: VercelResponse, caller: Caller, req: VercelRequest): Promise<void> {
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

  const activeBookings = await prisma.booking.findMany({
    where: { phone: caller.phone, status: { in: ["pending", "confirmed"] } },
    select: { dayKey: true, slotStart: true },
  });
  const activeNotPast = activeBookings.filter((b) => !isPast(b.dayKey, b.slotStart)).length;
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

// Owner: walk-in booking goes straight to confirmed, bypasses the per-user
// active-booking limit, but still respects maintenance/past/already-confirmed
// and declines any competing pending requests for the slot.
async function ownerCreate(res: VercelResponse, caller: Caller, req: VercelRequest): Promise<void> {
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

// Owner (confirm/decline) or owner-or-own-phone (cancel) manages an existing
// booking's status.
async function manage(res: VercelResponse, caller: Caller, req: VercelRequest): Promise<void> {
  const { action, bookingId } = (req.body ?? {}) as { action?: "confirm" | "cancel" | "decline"; bookingId?: string };
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

// Owner records, after the fact, whether a confirmed slot's match actually
// happened and how much was really collected — free-standing from `status`.
async function setResult(res: VercelResponse, caller: Caller, req: VercelRequest): Promise<void> {
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);

  const { action } = (req.body ?? {}) as { action?: Action };
  switch (action) {
    case "create": return create(res, caller, req);
    case "owner-create": return ownerCreate(res, caller, req);
    case "confirm": case "cancel": case "decline": return manage(res, caller, req);
    case "set-result": return setResult(res, caller, req);
    default: return badRequest(res, "action invalide.");
  }
}
