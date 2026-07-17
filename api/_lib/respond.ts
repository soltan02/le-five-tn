import type { VercelResponse } from "@vercel/node";

export function ok(res: VercelResponse, body: unknown): void {
  res.status(200).json({ ok: true, ...(body as object) });
}

export function fail(res: VercelResponse, status: number, error: string): void {
  res.status(status).json({ ok: false, error });
}

export const unauthorized = (res: VercelResponse): void => fail(res, 401, "unauthorized");
export const forbidden = (res: VercelResponse): void => fail(res, 403, "forbidden");
export const badRequest = (res: VercelResponse, error: string): void => fail(res, 400, error);
export const methodNotAllowed = (res: VercelResponse): void => fail(res, 405, "method not allowed");
