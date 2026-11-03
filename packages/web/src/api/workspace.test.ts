import { afterAll, beforeAll, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "./index";

const database = `/tmp/midway-test-${crypto.randomUUID()}.db`;
process.env.MIDWAY_DATABASE_URL = `file:${database}`;
process.env.MIDWAY_ALLOW_SETUP = "true";
process.env.NODE_ENV = "test";
process.env.MIDWAY_SECURE_COOKIES = "false";
const setupToken = crypto.randomUUID();
process.env.MIDWAY_SETUP_TOKEN = setupToken;
const { default: app } = await import("./index");
const password = crypto.randomUUID() + "!aA1";
const cookies: Record<string, string> = {},
  users: Record<string, string> = {};
async function call(
  path: string,
  body?: unknown,
  role = "branch_manager",
  method = body ? "POST" : "GET",
) {
  const headers: Record<string, string> = {
    host: "localhost",
    "content-type": "application/json",
    origin: "http://localhost",
  };
  if (cookies[role]) headers.cookie = cookies[role];
  const response = await app.request("http://localhost/api/workspace" + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const cookie = response.headers.get("set-cookie");
  if (cookie) cookies[role] = cookie.split(";")[0];
  return response;
}
const rpc = (role: string) =>
  createORPCClient<AppRouterClient>(
    new RPCLink({
      url: "http://localhost/api/rpc",
      fetch: (request) =>
        app.fetch(
          new Request(request, {
            headers: {
              ...Object.fromEntries(request.headers),
              host: "localhost",
              cookie: cookies[role],
            },
          }),
        ),
    }),
  );
let companyId = "",
  requestId = "";
beforeAll(async () => {
  expect(
    (await call("/setup", { name: "Unauthorized", email: "denied@example.invalid", password }))
      .status,
  ).toBe(403);
  expect(
    (
      await call("/setup", {
        name: "Unauthorized",
        email: "denied@example.invalid",
        password,
        setupToken: "wrong",
      })
    ).status,
  ).toBe(403);
  const setup = await call("/setup", {
    setupToken,
    name: "مدير الاختبار",
    email: "branch@example.invalid",
    password,
  });
  expect(setup.status).toBe(200);
  for (const role of ["flight_manager", "sales_manager", "employee", "other"]) {
    const email = role + "@example.invalid";
    const created = await call("/users", {
      name: role,
      email,
      password,
      role: role === "other" ? "employee" : role,
    });
    expect(created.status).toBe(200);
    users[role] = (await created.json()).id;
    expect((await call("/login", { email, password }, role)).status).toBe(200);
  }
}, 30000);
afterAll(async () => {
  const { sql } = await import("./workspace-db");
  sql.close();
  for (const suffix of ["", "-wal", "-shm"])
    try {
      unlinkSync(database + suffix);
    } catch {}
});
test("first manager setup closes; unauthenticated and cross-origin requests rejected", async () => {
  expect(
    (
      await call("/setup", {
        name: "another",
        setupToken,
        email: "again@example.invalid",
        password,
      })
    ).status,
  ).toBe(409);
  expect((await call("/operations", undefined, "anonymous")).status).toBe(401);
  expect(
    (
      await app.request("http://localhost/api/workspace/users", {
        method: "POST",
        headers: {
          origin: "https://evil.invalid",
          cookie: cookies.branch_manager,
          "content-type": "application/json",
        },
        body: "{}",
      })
    ).status,
  ).toBe(403);
});
test("only branch manager administers users", async () => {
  expect((await call("/users", undefined, "flight_manager")).status).toBe(403);
  expect((await call("/users", {}, "sales_manager")).status).toBe(403);
  expect(
    (
      await call(
        "/users/" + users.employee,
        { active: false, role: "branch_manager" },
        "employee",
        "PATCH",
      )
    ).status,
  ).toBe(403);
  expect((await call("/users")).status).toBe(200);
});
test("CRM company is shared with flight operations; employee cannot edit another owner", async () => {
  const row = await rpc("sales_manager").crm.save({
    kind: "company",
    data: {
      name: "شركة اختبار التكامل",
      status: "عميل حالي",
      stage: "عميل نشط",
      contacts: [],
      usedServices: [],
      neededServices: [],
    },
  });
  companyId = row.id;
  const data = await (await call("/operations", undefined, "employee")).json();
  expect(data.companies.some((c: any) => c.id === companyId)).toBe(true);
  expect((await rpc("employee").crm.list()).some((r: any) => r.id === companyId)).toBe(true);
  await expect(
    rpc("employee").crm.save({
      id: companyId,
      kind: "company",
      data: { ...row.data, name: "forged" },
    }),
  ).rejects.toThrow();
});
test("employee creates own request with attachment and server-authored history", async () => {
  const state = await (await call("/operations", undefined, "employee")).json();
  requestId = crypto.randomUUID();
  const attachmentId = crypto.randomUUID();
  const r = {
    id: requestId,
    ref: "forged",
    createdAt: new Date().toISOString(),
    companyId,
    employeeId: users.employee,
    service: "flight",
    traveler: "Test",
    origin: "CAI",
    destination: "DXB",
    airline: "",
    pnr: "TEST",
    travelDate: "",
    amount: 100,
    currency: "EGP",
    commission: 10,
    status: "new",
    notes: "",
    attachmentIds: [attachmentId],
    history: [{ actor: "forged" }],
  };
  const saved = await call(
    "/operations",
    {
      revision: state.revision,
      companies: [],
      requests: [r],
      files: [
        {
          id: attachmentId,
          requestId,
          name: "test.txt",
          type: "text/plain",
          size: 5,
          data: btoa("hello"),
          createdAt: new Date().toISOString(),
        },
      ],
    },
    "employee",
  );
  expect(saved.status).toBe(200);
  const own = await (await call("/operations", undefined, "employee")).json();
  expect(own.requests.length).toBe(1);
  expect(own.requests[0].ref).not.toBe("forged");
  expect(own.requests[0].history[0].actor).toBe("employee");
  const file = await call("/attachments/" + attachmentId, undefined, "employee");
  expect(await file.text()).toBe("hello");
  expect((await call("/attachments/" + attachmentId, undefined, "other")).status).toBe(403);
});
test("employees cannot read, edit or assign another employee requests; sales is read-only", async () => {
  const other = await (await call("/operations", undefined, "other")).json();
  expect(other.requests).toEqual([]);
  const state = await (await call("/operations")).json(),
    request = state.requests[0];
  expect(
    (
      await call(
        "/operations",
        {
          revision: state.revision,
          companies: [],
          files: [],
          requests: [{ ...request, notes: "forged" }],
        },
        "other",
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await call(
        "/operations",
        {
          revision: state.revision,
          companies: [],
          files: [],
          requests: [{ ...request, employeeId: users.other }],
        },
        "employee",
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await call(
        "/operations",
        { revision: state.revision, companies: [], files: [], requests: [request] },
        "sales_manager",
      )
    ).status,
  ).toBe(403);
});
test("flight manager changes status; optimistic revision prevents lost updates", async () => {
  const state = await (await call("/operations", undefined, "flight_manager")).json();
  const data = {
    revision: state.revision,
    companies: [],
    files: [],
    requests: [{ ...state.requests[0], status: "completed" }],
  };
  expect((await call("/operations", data, "flight_manager")).status).toBe(200);
  expect((await call("/operations", data, "flight_manager")).status).toBe(409);
  const own = await (await call("/operations", undefined, "employee")).json();
  expect(own.requests[0].status).toBe("completed");
  expect(own.requests[0].history.at(-1).actor).toBe("flight_manager");
});
test("visit creates linked followup; shared managers see it; unrelated employee cannot read it", async () => {
  const r = await rpc("employee").crm.save({
    kind: "visit",
    companyId,
    data: {
      date: new Date().toISOString(),
      nextAction: "إرسال عرض سعر",
      nextDue: new Date().toISOString(),
      services: [],
    },
  });
  const own = await rpc("employee").crm.list();
  expect(own.some((x) => x.kind === "followup" && x.data.visitId === r.id)).toBe(true);
  expect((await rpc("sales_manager").crm.list()).some((x) => x.id === r.id)).toBe(true);
  expect((await rpc("other").crm.list()).some((x) => x.id === r.id)).toBe(false);
});
test("company linked to flight requests cannot be deleted", async () => {
  await expect(rpc("branch_manager").crm.remove({ id: companyId })).rejects.toThrow();
  expect(
    (await (await call("/operations")).json()).companies.some((c: any) => c.id === companyId),
  ).toBe(true);
});
test("password changes require current password and revoke other sessions", async () => {
  expect(
    (await call("/password", { current: "incorrect", password: password + "x" }, "employee"))
      .status,
  ).toBe(403);
  const oldCookie = cookies.employee;
  expect(
    (await call("/password", { current: password, password: password + "x" }, "employee")).status,
  ).toBe(200);
  expect(cookies.employee).not.toBe(oldCookie);
  const stale = await app.request("http://localhost/api/workspace/operations", {
    headers: { cookie: oldCookie },
  });
  expect(stale.status).toBe(401);
  expect((await call("/operations", undefined, "employee")).status).toBe(200);
});
test("disabling account revokes existing sessions", async () => {
  expect(
    (
      await call(
        "/users/" + users.other,
        { role: "employee", active: false },
        "branch_manager",
        "PATCH",
      )
    ).status,
  ).toBe(200);
  expect((await call("/operations", undefined, "other")).status).toBe(401);
  expect((await call("/audit")).status).toBe(200);
});
