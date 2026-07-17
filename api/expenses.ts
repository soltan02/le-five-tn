import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { getCaller } from "./_lib/session";
import { ok, badRequest, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond";

// Bundled to stay under Vercel Hobby's 12-serverless-function cap.
// action: 'add' | 'delete'. Both owner-only.
type Action = "add" | "delete";
const CATEGORIES = ["rent", "electricity", "water", "staff", "maintenance", "equipment", "other"];

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);
  if (caller.role !== "owner") return forbidden(res);

  const body = (req.body ?? {}) as {
    action?: Action;
    category?: string; amount?: number | string; description?: string; expenseDate?: string;
    expenseId?: string;
  };

  if (body.action === "add") {
    if (!body.category || !CATEGORIES.includes(body.category)) return badRequest(res, "Catégorie invalide.");
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n <= 0) return badRequest(res, "Montant invalide.");

    const expense = await prisma.expense.create({
      data: {
        category: body.category as
          | "rent" | "electricity" | "water" | "staff" | "maintenance" | "equipment" | "other",
        amount: n,
        description: body.description?.trim() || null,
        expenseDate: body.expenseDate || new Date().toISOString().slice(0, 10),
        createdById: caller.id,
      },
    });
    return ok(res, { expense });
  }

  if (body.action === "delete") {
    if (!body.expenseId) return badRequest(res, "expenseId manquant.");
    await prisma.expense.delete({ where: { id: body.expenseId } });
    return ok(res, {});
  }

  return badRequest(res, "action invalide.");
}
