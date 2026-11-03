import { drizzle } from "drizzle-orm/d1";
import * as schema from "../src/api/database/schema";
import type { DatabaseRuntime } from "../src/api/runtime";

type Statement = string | { sql: string; args?: unknown[] };
function statement(input: Statement) {
  return typeof input === "string" ? { sql: input, args: [] } : input;
}
function parameter(value: unknown): unknown {
  if (value instanceof Uint8Array)
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  if (typeof value === "boolean") return Number(value);
  return value;
}
function result(value: D1Result) {
  // D1 JSON results encode BLOBs as arrays. libSQL callers expect binary bytes.
  const rows = (value.results || []).map((row) =>
    Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([key, item]) => [
        key,
        Array.isArray(item) ? new Uint8Array(item).buffer : item,
      ]),
    ),
  );
  return {
    rows,
    rowsAffected: value.meta.changes || 0,
    lastInsertRowid: value.meta.last_row_id || 0,
  };
}
export function databaseRuntime(database: D1Database): DatabaseRuntime {
  const prepare = (input: Statement) => {
    const s = statement(input);
    return database.prepare(s.sql).bind(...(s.args || []).map(parameter));
  };
  const execute = async (input: Statement) => result(await prepare(input).all());
  const sql = {
    execute,
    batch: async (inputs: Statement[]) => (await database.batch(inputs.map(prepare))).map(result),
    transaction: async () => {
      let expectedRevision: number | undefined;
      let closed = false;
      const writes: Statement[] = [];
      return {
        execute: async (input: Statement) => {
          if (closed) throw new Error("Transaction is closed");
          const s = statement(input);
          if (/^\s*SELECT\b/i.test(s.sql)) {
            if (writes.length) throw new Error("Read after queued writes is unsupported");
            const value = await execute(input);
            if (/SELECT revision,data FROM operation_state/i.test(s.sql))
              expectedRevision = Number((value.rows[0] as Record<string, unknown>)?.revision);
            return value;
          }
          writes.push(input);
          return { rows: [], rowsAffected: 0 };
        },
        commit: async () => {
          if (closed) throw new Error("Transaction is closed");
          if (expectedRevision === undefined)
            throw new Error("Operation revision must be read before committing");
          const id = crypto.randomUUID();
          // D1 has no interactive transactions. Its batch is atomic; a trigger aborts
          // the entire batch if the revision changed after the preceding reads.
          await database.batch([
            prepare({
              sql: "INSERT INTO operation_guards VALUES (?,?)",
              args: [id, expectedRevision],
            }),
            ...writes.map(prepare),
            prepare({ sql: "DELETE FROM operation_guards WHERE id=?", args: [id] }),
          ]);
          closed = true;
        },
        rollback: async () => {
          closed = true;
          writes.length = 0;
        },
        close: () => {
          closed = true;
        },
      };
    },
  };
  return { sql, db: drizzle(database, { schema }) } as unknown as DatabaseRuntime;
}
