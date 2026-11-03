import { AsyncLocalStorage } from "node:async_hooks";
import type * as Native from "./native-db";

export type DatabaseRuntime = { sql: typeof Native.sql; db: typeof Native.db };
export type Runtime = {
  database: DatabaseRuntime;
  env?: Record<string, unknown>;
  limits?: { attachmentBytes: number; totalUploadBytes: number; recordBytes: number };
};
export const runtime = new AsyncLocalStorage<Runtime>();
let fallback: DatabaseRuntime | undefined;
export function setDefaultDatabase(database: DatabaseRuntime) {
  fallback = database;
}
export function currentDatabase(): DatabaseRuntime {
  const database = runtime.getStore()?.database || fallback;
  if (!database) throw new Error("Database runtime has not been configured");
  return database;
}
export function setting(name: string): string | undefined {
  const context = runtime.getStore();
  // Never fall through to process-global secrets during Worker requests.
  if (context)
    return typeof context.env?.[name] === "string" ? (context.env[name] as string) : undefined;
  return process.env[name];
}
export function uploadLimits() {
  return (
    runtime.getStore()?.limits || {
      attachmentBytes: 5 * 1024 * 1024,
      totalUploadBytes: 20 * 1024 * 1024,
      recordBytes: 32 * 1024 * 1024,
    }
  );
}
