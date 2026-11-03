import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "./workspace-db";

export const roles = ["branch_manager", "flight_manager", "sales_manager", "employee"] as const;
export type Role = (typeof roles)[number];
export type User = { id: string; name: string; email: string; role: Role; active: number };
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function sessionUser(headers: Headers): Promise<User | null> {
  const cookie = headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("midway_session="))
    ?.slice(15);
  if (!cookie) return null;
  const r = await sql.execute({
    sql: "SELECT u.id,u.name,u.email,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1",
    args: [hash(cookie), Date.now()],
  });
  return (r.rows[0] as unknown as User) || null;
}
export async function issueSession(c: Context, id: string) {
  const token = randomBytes(32).toString("hex");
  await sql.execute({
    sql: "INSERT INTO sessions VALUES (?,?,?)",
    args: [hash(token), id, Date.now() + 8 * 3600000],
  });
  setCookie(c, "midway_session", token, {
    httpOnly: true,
    sameSite: "Strict",
    secure:
      process.env.MIDWAY_SECURE_COOKIES === "true" || new URL(c.req.url).protocol === "https:",
    path: "/",
    maxAge: 8 * 3600,
  });
}
export async function clearSession(c: Context) {
  const token = getCookie(c, "midway_session");
  if (token) await sql.execute({ sql: "DELETE FROM sessions WHERE token=?", args: [hash(token)] });
  deleteCookie(c, "midway_session", { path: "/" });
}
export async function audit(actor: string, action: string, target: string) {
  await sql.execute({
    sql: "INSERT INTO audit VALUES (?,?,?,?,?)",
    args: [crypto.randomUUID(), actor, action, target, new Date().toISOString()],
  });
}
