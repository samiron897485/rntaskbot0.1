import type { Request, Response, NextFunction } from "express";

const HARDCODED_ADMIN_IDS = ["1414414216", "7728185213"];

function getAdminIds(): string[] {
  const envIds = (process.env["ADMIN_IDS"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...HARDCODED_ADMIN_IDS, ...envIds];
}

export function isValidAdminToken(token: string): boolean {
  if (!token) return false;
  const adminToken = process.env["ADMIN_TOKEN"] || "";
  if (adminToken) {
    return token === adminToken;
  }
  return getAdminIds().includes(token);
}

export function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token =
    (req.headers["x-admin-token"] as string | undefined) ||
    (req.query["token"] as string | undefined) ||
    "";

  if (!isValidAdminToken(token)) {
    res.status(403).send("Access Denied");
    return;
  }

  next();
}
