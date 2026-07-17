import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_lib/db";
import { getCaller } from "./_lib/session";
import { ok, badRequest, unauthorized, forbidden, methodNotAllowed } from "./_lib/respond";

const CATEGORIES = ["rent", "electricity", "water", "staff", "maintenance", "equipment", "other"];

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const caller = await getCaller(req);
  if (!caller) return unauthorized(res);
  if (caller.role !== "owner") return forbidden(res);

  const { category, amount, description, expenseDate } = (req.body ?? {}) as {
    category?: string; amount?: number | string; description?: string; expenseDate?: string;
  };
  if (!category || !CATEGORIES.includes(category)) return badRequest(res, "Catégorie invalide.");
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return badRequest(res, "Montant invalide.");

  const expense = await prisma.expense.create({
    data: {
      category: category as
        | "rent" | "electricity" | "water" | "staff" | "maintenance" | "equipment" | "other",
      amount: n,
      description: description?.trim() || null,
      expenseDate: expenseDate || new Date().toISOString().slice(0, 10),
      createdById: caller.id,
    },
  });

  ok(res, { expense });
}
