import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { getCaller } from "./_lib/session";
import { upcomingDays, slotsForDay, dateKey, isPast } from "./_lib/dates";
import { ok, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond";

type Period = "week7" | "month30" | "thisMonth" | "lastMonth";

function periodRange(period: Period): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === "thisMonth") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: dateKey(from), to: dateKey(today) };
  }
  if (period === "lastMonth") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: dateKey(from), to: dateKey(to) };
  }
  const days = period === "month30" ? 30 : 7;
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));
  return { from: dateKey(from), to: dateKey(today) };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);
  if (caller.role !== "owner") return forbidden(res);

  const periodParam = String(req.query.period || "week7") as Period;
  const period: Period = ["week7", "month30", "thisMonth", "lastMonth"].includes(periodParam) ? periodParam : "week7";
  const { from, to } = periodRange(period);

  const days7 = upcomingDays(7).map((d) => d.key);
  const slotsPerDay = slotsForDay().length;

  const [
    pitches,
    activeBookingsNext7,
    confirmedNext7,
    allActiveBookings,
    pendingNotPastRaw,
    pastConfirmed,
    notifications,
    sms,
    suggestions,
    collectedAgg,
    expensesAgg,
    expensesForPeriod,
    unpaidPlayed,
  ] = await Promise.all([
    prisma.pitch.findMany({ where: { status: { not: "removed" } }, orderBy: { createdAt: "asc" } }),
    prisma.booking.findMany({ where: { dayKey: { in: days7 }, status: { in: ["pending", "confirmed"] } } }),
    prisma.booking.findMany({ where: { dayKey: { in: days7 }, status: "confirmed" }, include: { pitch: true } }),
    prisma.booking.findMany({ where: { status: { in: ["pending", "confirmed"] } }, select: { dayKey: true, slotStart: true } }),
    prisma.booking.findMany({ where: { status: "pending" } }),
    prisma.booking.findMany({ where: { status: "confirmed" }, orderBy: [{ dayKey: "desc" }, { slotStart: "desc" }], take: 60 }),
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.smsOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.suggestion.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.booking.aggregate({ _sum: { amountPaid: true }, where: { amountPaid: { not: null }, dayKey: { gte: from, lte: to } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: from, lte: to } } }),
    prisma.expense.findMany({ where: { expenseDate: { gte: from, lte: to } }, orderBy: { expenseDate: "desc" } }),
    prisma.booking.findMany({ where: { outcome: "played", amountPaid: null }, orderBy: [{ dayKey: "desc" }] }),
  ]);

  // occupancy/perDay/perHour/revenue — same math as the old client ownerStats().
  const bookablePitchCount = pitches.filter((p) => p.status === "active").length;
  const capacity = slotsPerDay * Math.max(1, bookablePitchCount) * days7.length;
  const occupancy = capacity ? Math.round((confirmedNext7.length / capacity) * 100) : 0;

  const perDay = upcomingDays(7).map((d) => ({
    ...d,
    count: activeBookingsNext7.filter((b) => b.dayKey === d.key).length,
  }));

  const perHour: Record<string, number> = {};
  slotsForDay().forEach((s) => (perHour[s.start] = 0));
  allActiveBookings.forEach((b) => {
    perHour[b.slotStart] = (perHour[b.slotStart] || 0) + 1;
  });

  const revenueProjected = confirmedNext7.reduce((sum, b) => sum + Number(b.pitch.price), 0);
  const pendingNotPast = pendingNotPastRaw.filter((b) => !isPast(b.dayKey, b.slotStart));
  // "Matchs passés" is for reconciling matches that already happened — a
  // future confirmed booking (which sorts first in a desc-by-date list) has
  // no business showing up here yet.
  const pastConfirmedOnly = pastConfirmed.filter((b) => isPast(b.dayKey, b.slotStart));

  const collected = Number(collectedAgg._sum.amountPaid ?? 0);
  const expensesTotal = Number(expensesAgg._sum.amount ?? 0);
  const netProfit = collected - expensesTotal;

  ok(res, {
    pitches,
    notifications,
    sms,
    suggestions,
    pendingBookings: pendingNotPast,
    pastConfirmedBookings: pastConfirmedOnly,
    unpaidPlayedBookings: unpaidPlayed,
    stats: {
      occupancy,
      perDay,
      perHour,
      revenueProjected,
      pendingCount: pendingNotPast.length,
      weekCount: confirmedNext7.length,
    },
    finance: {
      period,
      from,
      to,
      collected,
      expensesTotal,
      netProfit,
      expenses: expensesForPeriod,
    },
  });
}
