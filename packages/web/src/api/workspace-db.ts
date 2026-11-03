/// <reference types="bun" />
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import * as schema from "./database/schema";

const directory = resolve(import.meta.dirname, "../../../../.midway");
mkdirSync(directory, { recursive: true, mode: 0o700 });
export const sql = createClient({
  url: process.env.MIDWAY_DATABASE_URL || `file:${directory}/workspace.db`,
});
await sql.executeMultiple(`
 PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS crm_records (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL,
 company_id TEXT, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS crm_owner ON crm_records(owner_id);
 CREATE TABLE IF NOT EXISTS operation_state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL);
 INSERT OR IGNORE INTO operation_state VALUES (1,0,'{"requests":[]}');
 CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, name TEXT NOT NULL,
 type TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL);
`);
export const db = drizzle(sql, { schema });
