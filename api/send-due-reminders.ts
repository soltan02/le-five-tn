import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { slotStartMs } from "./_lib/dates";
import { ok, methodNotAllowed } from "./_lib/respond";
import { FACILITY } from "../src/config/facility.js";

const validPhone = (p: string) => !!p && p.replace(/\D/g, "").length >= 8;

function reminderText(pitchName: string, slotStart: string): string {
  return `${FACILITY.name}: Rappel - votre match ${pitchName} commence a ${slotStart} (dans 1h). Bon match!`;
}

// Called on a client-side interval (App.jsx's ReminderScheduler) — same
// "only works while a tab is open" limitation as the old localStorage
// version, kept as an explicit Stage 1 parity choice (SMS is still
// simulated regardless, so a server-side pg_cron trigger wouldn't make the
// reminders any more real — just more punctual — and is a cheap addition
// later if ever needed).
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const now = Date.now();
  const candidates = await prisma.booking.findMany({
    where: { status: "confirmed", reminded: false },
    include: { pitch: true },
  });

  const due = candidates.filter((b) => {
    if (!validPhone(b.phone)) return false;
    const diff = slotStartMs(b.dayKey, b.slotStart) - now;
    return diff > 0 && diff <= 60 * 60000;
  });

  if (due.length > 0) {
    await prisma.$transaction([
      prisma.booking.updateMany({ where: { id: { in: due.map((b) => b.id) } }, data: { reminded: true } }),
      prisma.smsOutbox.createMany({
        data: due.map((b) => ({ toPhone: b.phone, body: reminderText(b.pitch.name, b.slotStart), kind: "reminder" as const })),
      }),
    ]);
  }

  ok(res, { count: due.length });
}
