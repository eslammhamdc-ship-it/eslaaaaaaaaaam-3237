import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api, roleNames, useWorkspace, type User } from "../lib/workspace";
export default function Team() {
  const { user } = useWorkspace();
  const [users, setUsers] = useState<User[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [events, setEvents] = useState<any[]>([]);
  const refresh = async () => {
    setUsers(await api("/users"));
    setEvents(await api("/audit"));
  };
  useEffect(() => {
    if (user.role === "branch_manager") void refresh().catch((e) => setError(e.message));
  }, [user.role]);
  if (user.role !== "branch_manager")
    return (
      <main className="portal" dir="rtl">
        <h1>إدارة الفريق متاحة لمدير الفرع</h1>
        <Link href="/">العودة</Link>
      </main>
    );
  return (
    <main className="portal" dir="rtl">
      <Link href="/">← لوحة الفرع والعمليات</Link>
      <h1>إدارة الفريق والصلاحيات</h1>
      <p>
        مدير الفرع ← مدير الطيران ومدير المبيعات ← موظفو الطيران. الحسابات تتشارك بيانات الفرع حسب
        صلاحياتها.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <section className="portal-panel">
        <h2>إضافة حساب</h2>
        <form
          className="team-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            setError("");
            try {
              await api("/users", Object.fromEntries(new FormData(form)));
              form.reset();
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            الاسم
            <input aria-label="الاسم" name="name" required minLength={2} />
          </label>
          <label>
            البريد الإلكتروني
            <input aria-label="البريد الإلكتروني" name="email" type="email" required dir="ltr" />
          </label>
          <label>
            كلمة مرور أولية
            <input
              aria-label="كلمة المرور"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </label>
          <label>
            الدور
            <select aria-label="الدور" name="role" defaultValue="employee">
              {Object.entries(roleNames).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button primary" disabled={busy}>
            إضافة الحساب
          </button>
        </form>
      </section>
      <section className="portal-panel">
        <h2>حسابات الفرع</h2>
        <div className="team-grid">
          {users.map((u) => (
            <article key={u.id}>
              <h3>{u.name}</h3>
              <p dir="ltr">{u.email}</p>
              <p>
                {roleNames[u.role]} · {u.active ? "نشط" : "موقوف"}
              </p>
              {u.id !== user.id && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError("");
                    const f = new FormData(e.currentTarget);
                    try {
                      await api(
                        "/users/" + u.id,
                        {
                          role: f.get("role"),
                          active: f.get("active") === "on",
                          ...(f.get("password") ? { password: f.get("password") } : {}),
                        },
                        "PATCH",
                      );
                      await refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    صلاحية الحساب
                    <select aria-label="الدور" name="role" defaultValue={u.role}>
                      {Object.entries(roleNames).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <input
                      aria-label="حساب نشط"
                      type="checkbox"
                      name="active"
                      defaultChecked={!!u.active}
                    />{" "}
                    حساب نشط
                  </label>
                  <label>
                    كلمة مرور جديدة (اختياري)
                    <input
                      aria-label="كلمة المرور"
                      name="password"
                      type="password"
                      minLength={12}
                      autoComplete="new-password"
                    />
                  </label>
                  <button className="button secondary" disabled={busy}>
                    حفظ الصلاحيات
                  </button>
                </form>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="portal-panel">
        <h2>سجل إجراءات الإدارة والعمليات</h2>
        {events.length ? (
          events.map((event) => (
            <p key={event.id}>
              {event.name} ·{" "}
              {(
                {
                  create_user: "إضافة حساب",
                  update_user: "تحديث حساب",
                  setup: "إعداد الفرع",
                  create_request: "إنشاء طلب",
                  update_request: "تحديث طلب",
                  change_password: "تغيير كلمة مرور",
                  create_crm: "إضافة سجل عملاء",
                  update_crm: "تحديث سجل عملاء",
                  delete_crm: "حذف سجل عملاء",
                } as Record<string, string>
              )[event.action] || event.action}{" "}
              · {new Date(event.created_at).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}
            </p>
          ))
        ) : (
          <p>لا توجد إجراءات مسجلة بعد.</p>
        )}
      </section>
    </main>
  );
}
