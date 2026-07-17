import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { getCaller } from "./_lib/session";
import { ok, badRequest, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);
  if (caller.role !== "owner") return forbidden(res);

  const { expenseId } = (req.body ?? {}) as { expenseId?: string };
  if (!expenseId) return badRequest(res, "expenseId manquant.");

  await prisma.expense.delete({ where: { id: expenseId } });
  ok(res, {});
}
