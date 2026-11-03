import { ORPCError } from "@orpc/server";
import { or, eq, sql as expression } from "drizzle-orm";
import { base } from "../__core/app";
import { sessionUser, type User } from "../session";
import { records } from "../database/schema";
export const scope = (user: User) =>
  user.role === "employee"
    ? or(eq(records.ownerId, user.id), eq(records.kind, "company"))!
    : expression`1=1`;
export const editable = (user: User, owner: string) =>
  user.role === "branch_manager" || user.role === "sales_manager" || user.id === owner;
export const authed = base.use(async ({ context, next }) => {
  const user = await sessionUser(context.headers);
  if (!user) throw new ORPCError("UNAUTHORIZED");
  const origin = context.headers.get("origin");
  const host = context.headers.get("host");
  if (origin && new URL(origin).host !== host) throw new ORPCError("FORBIDDEN");
  return next({ context: { user } });
});
