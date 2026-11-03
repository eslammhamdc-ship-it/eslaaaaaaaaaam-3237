import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("native initialization preserves legacy requests, revision and account hashes", () => {
  const directory = mkdtempSync(join(tmpdir(), "midway-legacy-"));
  const file = join(directory, "workspace.db");
  try {
    const old = new Database(file);
    old.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT UNIQUE,password TEXT,role TEXT,active INTEGER);
   CREATE TABLE crm_records(id TEXT PRIMARY KEY,owner_id TEXT,kind TEXT,company_id TEXT,data TEXT,created_at TEXT,updated_at TEXT);
   CREATE TABLE operation_state(id INTEGER PRIMARY KEY,revision INTEGER,data TEXT);`);
    old
      .query("INSERT INTO users VALUES (?,?,?,?,?,?)")
      .run("employee", "Legacy", "legacy@example.invalid", "original-password-hash", "employee", 1);
    old
      .query("INSERT INTO crm_records VALUES (?,?,?,?,?,?,?)")
      .run(
        "company",
        "employee",
        "company",
        null,
        '{"name":"Legacy company"}',
        "2026-01-01",
        "2026-01-01",
      );
    const request = {
      id: "old-flight",
      employeeId: "employee",
      companyId: "company",
      history: [{ note: "preserve history" }],
      attachmentIds: ["legacy-attachment"],
    };
    old
      .query("INSERT INTO operation_state VALUES (1,7,?)")
      .run(JSON.stringify({ requests: [request] }));
    old.close();
    const module = new URL("./native-db.ts", import.meta.url).href;
    const script = `const {sql}=await import(${JSON.stringify(module)});
    const requests=(await sql.execute('SELECT data FROM flight_requests')).rows;
    if(requests.length!==1||JSON.stringify(JSON.parse(requests[0].data))!==${JSON.stringify(JSON.stringify(request))})throw new Error('Legacy request changed');
    const state=(await sql.execute('SELECT revision,data FROM operation_state')).rows[0];
    if(Number(state.revision)!==7||JSON.parse(state.data).requests.length!==0)throw new Error('Revision or snapshot migration failed');
    if((await sql.execute('SELECT password FROM users')).rows[0].password!=='original-password-hash')throw new Error('Password hash changed');
    sql.close();`;
    const child = Bun.spawnSync([process.execPath, "-e", script], {
      env: { ...process.env, MIDWAY_DATABASE_URL: `file:${file}` },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(child.exitCode, new TextDecoder().decode(child.stderr)).toBe(0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
