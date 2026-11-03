import { Hono } from "hono";
import { createHash, timingSafeEqual } from "node:crypto";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { sql } from "./workspace-db";
import { roles, sessionUser, issueSession, clearSession, audit, type User } from "./session";

const app = new Hono<{ Variables: { user: User } }>();
app.use(
  "*",
  bodyLimit({
    maxSize: 32 * 1024 * 1024,
    onError: () => new Response("Request too large", { status: 413 }),
  }),
);
const account = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().transform((x) => x.toLowerCase()),
  password: z.string().min(12).max(128),
  role: z.enum(roles),
});
const failure = (message: string, status = 400) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
app.use("*", async (c, next) => {
  try {
    c.header("Cache-Control", "no-store");
    const origin = c.req.header("origin");
    if (origin && new URL(origin).host !== new URL(c.req.url).host)
      return failure("مصدر الطلب غير مسموح", 403);
    if (!["GET", "HEAD"].includes(c.req.method)) {
      if (Number(c.req.header("content-length") || 0) > 32 * 1024 * 1024)
        return failure("حجم الطلب كبير", 413);
    }
    await next();
  } catch (e) {
    if (e instanceof z.ZodError)
      return failure("راجع البيانات المطلوبة وصيغة البريد وكلمة المرور (12 حرفًا على الأقل)");
    console.error("Workspace request failed:", e instanceof Error ? e.message : "unknown");
    return failure("تعذر تنفيذ العملية. حاول مرة أخرى.", 500);
  }
});
app.get("/session", async (c) => {
  const user = await sessionUser(c.req.raw.headers);
  const count = await sql.execute("SELECT COUNT(*) AS n FROM users");
  return c.json({
    user,
    needsSetup: Number(count.rows[0].n) === 0,
    setupEnabled: process.env.MIDWAY_ALLOW_SETUP === "true",
    setupTokenRequired: !!process.env.MIDWAY_SETUP_TOKEN,
  });
});
app.post("/setup", async (c) => {
  if (process.env.MIDWAY_ALLOW_SETUP !== "true")
    return failure("إعداد أول مدير غير مفعل على الخادم", 403);
  const body = z
    .object({ setupToken: z.string().max(1024).optional() })
    .passthrough()
    .parse(await c.req.json());
  const token = process.env.MIDWAY_SETUP_TOKEN;
  if (
    (process.env.NODE_ENV === "production" || process.env.MIDWAY_SECURE_COOKIES === "true") &&
    !token
  )
    return failure("يجب إعداد رمز خاص لإنشاء أول مدير على الإنترنت", 403);
  if (token) {
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (
      typeof body.setupToken !== "string" ||
      !timingSafeEqual(digest(token), digest(body.setupToken))
    )
      return failure("رمز إعداد الفرع غير صحيح", 403);
  }
  const input = account.parse({ ...body, role: "branch_manager" });
  const password = await Bun.password.hash(input.password);
  const id = crypto.randomUUID();
  const result = await sql.execute({
    sql: "INSERT INTO users (id,name,email,password,role) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM users)",
    args: [id, input.name, input.email, password, input.role],
  });
  if (!result.rowsAffected) return failure("تم إعداد المدير بالفعل؛ سجّل الدخول", 409);
  await issueSession(c, id);
  await audit(id, "setup", id);
  return c.json({ ok: true });
});
// Rate limits persist in memory only; accounts and sessions persist in SQLite.
const attempts = new Map<string, { count: number; until: number }>();
app.post("/login", async (c) => {
  const input = z
    .object({ email: z.email().transform((x) => x.toLowerCase()), password: z.string().max(128) })
    .parse(await c.req.json());
  const key = input.email;
  if (attempts.size > 10000)
    for (const [k, v] of attempts) if (v.until < Date.now()) attempts.delete(k);
  const attempt = attempts.get(key);
  if (attempt && attempt.until > Date.now() && attempt.count >= 10)
    return failure("محاولات كثيرة؛ انتظر 15 دقيقة", 429);
  const result = await sql.execute({
    sql: "SELECT * FROM users WHERE email=? AND active=1",
    args: [input.email],
  });
  const row = result.rows[0];
  if (!row || !(await Bun.password.verify(input.password, String(row.password)))) {
    attempts.set(key, {
      count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1,
      until: attempt && attempt.until > Date.now() ? attempt.until : Date.now() + 900000,
    });
    return failure("البريد أو كلمة المرور غير صحيحة", 401);
  }
  attempts.delete(key);
  await issueSession(c, String(row.id));
  return c.json({ ok: true });
});
app.post("/logout", async (c) => {
  await clearSession(c);
  return c.json({ ok: true });
});
app.use("*", async (c, next) => {
  const user = await sessionUser(c.req.raw.headers);
  if (!user) return failure("سجّل الدخول أولاً", 401);
  c.set("user", user);
  await next();
});
app.post("/password", async (c) => {
  const user = c.get("user");
  const input = z
    .object({ current: z.string().max(128), password: z.string().min(12).max(128) })
    .parse(await c.req.json());
  const row = (await sql.execute({ sql: "SELECT password FROM users WHERE id=?", args: [user.id] }))
    .rows[0];
  if (!(await Bun.password.verify(input.current, String(row.password))))
    return failure("كلمة المرور الحالية غير صحيحة", 403);
  const password = await Bun.password.hash(input.password);
  await sql.batch(
    [
      { sql: "UPDATE users SET password=? WHERE id=?", args: [password, user.id] },
      { sql: "DELETE FROM sessions WHERE user_id=?", args: [user.id] },
    ],
    "write",
  );
  await issueSession(c, user.id);
  await audit(user.id, "change_password", user.id);
  return c.json({ ok: true });
});
app.get("/users", async (c) => {
  if (c.get("user").role !== "branch_manager") return failure("هذه الصفحة لمدير الفرع", 403);
  return c.json(
    (await sql.execute("SELECT id,name,email,role,active FROM users ORDER BY name")).rows,
  );
});
app.post("/users", async (c) => {
  const actor = c.get("user");
  if (actor.role !== "branch_manager") return failure("إدارة الحسابات لمدير الفرع", 403);
  const input = account.parse(await c.req.json());
  const id = crypto.randomUUID(),
    password = await Bun.password.hash(input.password);
  try {
    await sql.execute({
      sql: "INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)",
      args: [id, input.name, input.email, password, input.role],
    });
  } catch {
    return failure("البريد مستخدم بالفعل", 409);
  }
  await audit(actor.id, "create_user", id);
  return c.json({ id });
});
app.patch("/users/:id", async (c) => {
  const actor = c.get("user");
  if (actor.role !== "branch_manager") return failure("إدارة الحسابات لمدير الفرع", 403);
  const id = c.req.param("id");
  const input = z
    .object({
      active: z.boolean(),
      role: z.enum(roles),
      password: z.string().min(12).max(128).optional(),
    })
    .parse(await c.req.json());
  if (id === actor.id) return failure("لا يمكن تغيير صلاحيات حسابك أو إيقافه من هنا");
  const password = input.password ? await Bun.password.hash(input.password) : null;
  const r = await sql.execute({
    sql: "UPDATE users SET active=?,role=?,password=COALESCE(?,password) WHERE id=?",
    args: [Number(input.active), input.role, password, id],
  });
  if (!r.rowsAffected) return failure("حساب غير موجود", 404);
  await sql.execute({ sql: "DELETE FROM sessions WHERE user_id=?", args: [id] });
  await audit(actor.id, "update_user", id);
  return c.json({ ok: true });
});
app.get("/audit", async (c) => {
  if (c.get("user").role !== "branch_manager") return failure("غير مسموح", 403);
  return c.json(
    (
      await sql.execute(
        "SELECT a.*,u.name FROM audit a LEFT JOIN users u ON a.actor=u.id ORDER BY a.created_at DESC LIMIT 100",
      )
    ).rows,
  );
});
function canOperate(user: User, employeeId: string) {
  return (
    ["branch_manager", "flight_manager"].includes(user.role) ||
    (user.role === "employee" && user.id === employeeId)
  );
}
async function state() {
  return (await sql.execute("SELECT revision,data FROM operation_state WHERE id=1")).rows[0];
}
async function companies() {
  return (await sql.execute("SELECT id,data FROM crm_records WHERE kind='company'")).rows.map(
    (r) => {
      const d = JSON.parse(String(r.data));
      return {
        id: String(r.id),
        name: d.name,
        contact: d.contact || d.contacts?.[0]?.name || "",
        details: d.phone || d.email || "",
        notes: d.notes || "",
        active: d.status !== "عميل غير نشط",
      };
    },
  );
}
app.get("/operations", async (c) => {
  const user = c.get("user"),
    s = await state();
  const requests = JSON.parse(String(s.data)).requests;
  const users = (await sql.execute("SELECT id,name,active FROM users WHERE role='employee'")).rows;
  return c.json({
    revision: Number(s.revision),
    requests:
      user.role === "employee" ? requests.filter((r: any) => r.employeeId === user.id) : requests,
    companies: await companies(),
    employees: users
      .filter((u) => user.role !== "employee" || u.id === user.id)
      .map((u) => ({
        id: u.id,
        name: u.name,
        active: !!u.active,
        role: "موظف طيران",
        code: String(u.id).slice(0, 8),
        initials: String(u.name)
          .split(" ")
          .slice(0, 2)
          .map((x) => x[0])
          .join(" "),
        color: "blue",
      })),
  });
});
const requestSchema = z.object({
  id: z.string().min(1).max(100),
  ref: z.string().max(100),
  createdAt: z.iso.datetime(),
  companyId: z.string(),
  employeeId: z.string(),
  service: z.enum(["flight", "change", "refund", "visa", "umrah", "other"]),
  traveler: z.string().max(200),
  origin: z.string().max(100),
  destination: z.string().max(100),
  airline: z.string().max(200),
  pnr: z.string().max(100),
  travelDate: z.string().max(20),
  amount: z.number().finite().nonnegative().nullable(),
  currency: z.enum(["EGP", "USD", "SAR", "EUR"]),
  commission: z.number().finite().nonnegative().nullable(),
  status: z.enum(["new", "progress", "waiting", "completed", "cancelled", "refunded"]),
  notes: z.string().max(20000),
  attachmentIds: z.array(z.string()).max(100),
  history: z.array(z.any()).max(10000),
});
app.post("/operations", async (c) => {
  const user = c.get("user");
  if (user.role === "sales_manager")
    return failure("مدير المبيعات يطّلع على العمليات؛ تعديلها لمدير الطيران وموظفيه", 403);
  const input = z
    .object({
      revision: z.number().int(),
      requests: z.array(requestSchema).max(10000),
      companies: z.array(
        z.object({
          id: z.string(),
          name: z.string().trim().min(1).max(200),
          contact: z.string().max(200),
          details: z.string().max(500),
          notes: z.string().max(20000),
          active: z.boolean(),
        }),
      ),
      files: z
        .array(
          z.object({
            id: z.string(),
            requestId: z.string(),
            name: z.string().max(200),
            type: z.enum([
              "image/jpeg",
              "image/png",
              "image/webp",
              "application/pdf",
              "text/plain",
            ]),
            size: z
              .number()
              .int()
              .min(0)
              .max(5 * 1024 * 1024),
            data: z.string().max(7 * 1024 * 1024),
            createdAt: z.iso.datetime(),
          }),
        )
        .max(20),
    })
    .parse(await c.req.json());
  const tx = await sql.transaction("write");
  try {
    const s = (await tx.execute("SELECT revision,data FROM operation_state WHERE id=1")).rows[0];
    if (Number(s.revision) !== input.revision) {
      await tx.rollback();
      return failure("حدث تحديث من مستخدم آخر. أعد تحميل البيانات ثم احفظ مجددًا.", 409);
    }
    const old = JSON.parse(String(s.data)).requests as any[];
    const merged = new Map(old.map((r) => [r.id, r]));
    const companyRows = (
      await tx.execute("SELECT id,owner_id,data FROM crm_records WHERE kind='company'")
    ).rows;
    const companyMap = new Map(companyRows.map((r) => [String(r.id), r]));
    const writes = [];
    const allIds = new Set(
      (await tx.execute("SELECT id FROM crm_records")).rows.map((r) => String(r.id)),
    );
    for (const company of input.companies) {
      const before = companyMap.get(company.id),
        d = before ? JSON.parse(String(before.data)) : {};
      if (!before && allIds.has(company.id)) {
        await tx.rollback();
        return failure("معرف الشركة مستخدم لسجل آخر");
      }
      const normalize = (name: string) =>
        name
          .toLowerCase()
          .replace(/[أإآ]/g, "ا")
          .replace(/ة/g, "ه")
          .replace(/[^\p{L}\p{N}]/gu, "");
      if (
        companyRows.some(
          (r) =>
            String(r.id) !== company.id &&
            normalize(JSON.parse(String(r.data)).name || "") === normalize(company.name),
        )
      ) {
        await tx.rollback();
        return failure("توجد شركة بهذا الاسم بالفعل", 409);
      }
      const changed =
        !before ||
        company.name !== d.name ||
        company.contact !== (d.contact || d.contacts?.[0]?.name || "") ||
        company.details !== (d.phone || d.email || "") ||
        company.notes !== (d.notes || "") ||
        company.active !== (d.status !== "عميل غير نشط");
      if (!changed) continue;
      if (!["branch_manager", "flight_manager"].includes(user.role)) {
        await tx.rollback();
        return failure("تعديل الشركات من خلال إدارة العملاء", 403);
      }
      const data = {
        ...d,
        name: company.name,
        contact: company.contact,
        phone: company.details,
        notes: company.notes,
        status: company.active ? "عميل حالي" : "عميل غير نشط",
        stage: d.stage || "عميل نشط",
        contacts: d.contacts || [],
        usedServices: d.usedServices || [],
        neededServices: d.neededServices || [],
      };
      const now = new Date().toISOString();
      writes.push({
        sql: "INSERT INTO crm_records VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
        args: [
          company.id,
          before ? String(before.owner_id) : user.id,
          "company",
          null,
          JSON.stringify(data),
          now,
          now,
        ],
      });
      companyMap.set(company.id, before || ({ id: company.id } as any));
    }
    const employees = new Set(
      (await tx.execute("SELECT id FROM users WHERE role='employee' AND active=1")).rows.map(
        (r) => r.id,
      ),
    );
    for (const request of input.requests) {
      const before = merged.get(request.id);
      if (before && JSON.stringify(before) === JSON.stringify(request)) continue;
      if (
        !canOperate(user, request.employeeId) ||
        (before && !canOperate(user, before.employeeId))
      ) {
        await tx.rollback();
        return failure("ليس لديك صلاحية تعديل هذا الطلب", 403);
      }
      if (
        !companyMap.has(request.companyId) ||
        (!employees.has(request.employeeId) &&
          (!before || before.employeeId !== request.employeeId))
      ) {
        await tx.rollback();
        return failure("اختر شركة وموظفًا نشطًا", 400);
      }
      const available = new Set([
        ...(before?.attachmentIds || []),
        ...input.files.filter((f) => f.requestId === request.id).map((f) => f.id),
      ]);
      if (request.attachmentIds.some((id) => !available.has(id))) {
        await tx.rollback();
        return failure("مرفق غير صالح");
      }
      const now = new Date().toISOString();
      merged.set(request.id, {
        ...request,
        createdAt: before?.createdAt || now,
        ref: before?.ref || `MW-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        history: [
          ...(before?.history || []),
          {
            id: crypto.randomUUID(),
            status: request.status,
            time: now,
            actor: user.name,
            note: before ? "تحديث الطلب" : "إنشاء الطلب",
          },
        ],
      });
      writes.push({
        sql: "INSERT INTO audit VALUES (?,?,?,?,?)",
        args: [
          crypto.randomUUID(),
          user.id,
          before ? "update_request" : "create_request",
          request.id,
          now,
        ],
      });
    }
    let bytes = 0;
    for (const file of input.files) {
      const request = merged.get(file.requestId),
        data = Buffer.from(file.data, "base64");
      bytes += data.length;
      if (
        !request ||
        !canOperate(user, request.employeeId) ||
        !request.attachmentIds.includes(file.id) ||
        data.length !== file.size ||
        bytes > 20 * 1024 * 1024
      ) {
        await tx.rollback();
        return failure("المرفق غير صالح أو تجاوز الحد المسموح");
      }
      writes.push({
        sql: "INSERT INTO attachments VALUES (?,?,?,?,?,?,?)",
        args: [file.id, file.requestId, file.name, file.type, file.size, data, file.createdAt],
      });
    }
    for (const write of writes) await tx.execute(write);
    await tx.execute({
      sql: "UPDATE operation_state SET revision=revision+1,data=? WHERE id=1",
      args: [JSON.stringify({ requests: [...merged.values()] })],
    });
    await tx.commit();
    return c.json({ ok: true });
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
});
app.get("/attachments/:id", async (c) => {
  const file = (
    await sql.execute({ sql: "SELECT * FROM attachments WHERE id=?", args: [c.req.param("id")] })
  ).rows[0];
  if (!file) return failure("مرفق غير موجود", 404);
  const user = c.get("user"),
    s = await state();
  const request = JSON.parse(String(s.data)).requests.find((r: any) => r.id === file.request_id);
  if (!request || (user.role === "employee" && request.employeeId !== user.id))
    return failure("غير مسموح", 403);
  return new Response(new Blob([file.data as ArrayBuffer]), {
    headers: {
      "Content-Type": String(file.type),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(String(file.name))}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
export default app;
