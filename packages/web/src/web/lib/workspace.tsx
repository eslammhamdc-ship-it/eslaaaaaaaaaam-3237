import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
export type User = {
  id: string;
  name: string;
  email: string;
  role: "branch_manager" | "flight_manager" | "sales_manager" | "employee";
  active: number;
};
export const roleNames = {
  branch_manager: "مدير الفرع",
  flight_manager: "مدير الطيران",
  sales_manager: "مدير المبيعات",
  employee: "موظف طيران",
};
export async function api<T = any>(
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
): Promise<T> {
  const options: RequestInit = { method, credentials: "same-origin" };
  if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch("/api/workspace" + path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "تعذر تنفيذ العملية");
  return data;
}
const Context = createContext<{ user: User; demoMode: boolean; logout: () => Promise<void> }>(
  {} as any,
);
export const useWorkspace = () => useContext(Context);
export function SessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    user: User | null;
    needsSetup: boolean;
    setupEnabled: boolean;
    setupTokenRequired: boolean;
    demoMode: boolean;
  }>();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    api("/session")
      .then(setState)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void refresh();
  }, []);
  if (state?.user)
    return (
      <Context.Provider
        value={{
          user: state.user,
          demoMode: state.demoMode,
          logout: async () => {
            await api("/logout", {});
            window.location.assign("/");
          },
        }}
      >
        {children}
      </Context.Provider>
    );
  return (
    <div className="session-screen" dir="rtl">
      <section className="session-card">
        <div className="eyebrow">MIDWAY TRAVEL</div>
        <h1>{state?.needsSetup ? "إعداد مساحة عمل الفرع" : "أهلًا بك في ميدواي"}</h1>
        <p>
          {state?.needsSetup
            ? "أنشئ حساب مدير الفرع الأول، ثم أضف المديرين والموظفين من إدارة الفريق."
            : "سجّل الدخول لحسابك؛ مساحة العمل والصلاحيات بتتحدد حسب دورك."}
        </p>
        {state?.demoMode && <DemoNotice enabled />}
        {!state && !error && <p>جارٍ الاتصال…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {state?.needsSetup && !state.setupEnabled ? (
          <p>
            تفعيل الإعداد الأول يتطلب تشغيل الخادم مع MIDWAY_ALLOW_SETUP=true. يُغلق إنشاء أول مدير
            تلقائيًا بعد الإعداد.
          </p>
        ) : (
          state && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setBusy(true);
                const f = new FormData(e.currentTarget);
                try {
                  await api(state.needsSetup ? "/setup" : "/login", Object.fromEntries(f));
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {state.needsSetup && state.setupTokenRequired && (
                <label>
                  رمز إعداد الفرع
                  <input
                    aria-label="رمز إعداد الفرع"
                    name="setupToken"
                    type="password"
                    required
                    autoComplete="off"
                  />
                  <small>من إعدادات الاستضافة؛ يُستخدم مرة واحدة لإنشاء أول مدير.</small>
                </label>
              )}
              {state.needsSetup && (
                <label>
                  اسم مدير الفرع
                  <input
                    aria-label="اسم مدير الفرع"
                    name="name"
                    required
                    minLength={2}
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                البريد الإلكتروني
                <input
                  aria-label="البريد الإلكتروني"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  dir="ltr"
                />
              </label>
              <label>
                كلمة المرور
                <input
                  aria-label="كلمة المرور"
                  name="password"
                  type="password"
                  required
                  minLength={state.needsSetup ? 12 : 1}
                  maxLength={128}
                  autoComplete={state.needsSetup ? "new-password" : "current-password"}
                  dir="ltr"
                />
              </label>
              <button className="button primary" disabled={busy}>
                {busy ? "جارٍ التنفيذ…" : state.needsSetup ? "إنشاء مساحة العمل" : "تسجيل الدخول"}
              </button>
            </form>
          )
        )}
      </section>
    </div>
  );
}

export function DemoNotice({ enabled }: { enabled?: boolean }) {
  const context = useWorkspace();
  if (!(enabled ?? context?.demoMode)) return null;
  return (
    <aside className="demo-notice" aria-label="نسخة عرض مؤقتة">
      <strong>نسخة عرض مجانية مؤقتة</strong>
      <p>
        الحسابات والطلبات والمرفقات قد تُفقد عند توقف الخدمة أو إعادة نشرها. استخدم بيانات تجريبية
        فقط، ويمكن تجهيزها من جديد قبل العرض.
      </p>
    </aside>
  );
}
