import { useState } from "react";
import { Link } from "wouter";
import { api, useWorkspace, roleNames } from "../lib/workspace";
export default function Account() {
  const { user } = useWorkspace();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="portal" dir="rtl">
      <Link href="/">← العودة لمساحة العمل</Link>
      <h1>حسابي</h1>
      <p>
        {user.name} · {roleNames[user.role]} · {user.email}
      </p>
      <section className="portal-panel">
        <h2>تغيير كلمة المرور</h2>
        <form
          className="team-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            setMessage("");
            try {
              await api("/password", Object.fromEntries(new FormData(form)));
              form.reset();
              setMessage("تم تغيير كلمة المرور وإغلاق الجلسات الأخرى");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            كلمة المرور الحالية
            <input
              aria-label="كلمة المرور الحالية"
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            كلمة المرور الجديدة
            <input
              aria-label="كلمة المرور الجديدة"
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
          <button className="button primary" disabled={busy}>
            تغيير كلمة المرور
          </button>
          <output>{message}</output>
        </form>
      </section>
    </main>
  );
}
