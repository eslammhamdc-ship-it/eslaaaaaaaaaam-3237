import { useState } from "react";
import { X, Plus, Trash2, ChevronDown, Save } from "lucide-react";
import { fields, detailedVisit, defaults, labels, type Field, type Row } from "../lib/crm";
import { areaName, proposeFollowup, suggestedDate } from "../lib/intelligence";
import { useSave } from "../queries/crm";
const names: Record<string, string> = {
  company: "شركة",
  visit: "زيارة",
  followup: "متابعة",
  opportunity: "فرصة بيع",
  stop: "محطة في خطة اليوم",
  event: "تواصل / ملاحظة",
};
function dt(v: string, t?: string) {
  if (!v) return "";
  if (t === "datetime-local" && v.endsWith("Z")) {
    const d = new Date(v);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  return v;
}
export function RecordForm({
  kind,
  row,
  companyId,
  rows,
  close,
}: {
  kind: string;
  row?: Row;
  companyId?: string;
  rows: Row[];
  close: () => void;
}) {
  const [data, setData] = useState<Record<string, any>>(() => ({
    ...defaults(kind, companyId),
    ...(kind === "stop" && !row
      ? {
          order:
            Math.max(
              0,
              ...rows.filter((r) => r.kind === "stop").map((r) => Number(r.data.order) || 0),
            ) + 1,
        }
      : {}),
    ...(kind === "visit"
      ? {
          customerStatus: rows.find((r) => r.id === companyId)?.data.status || "",
          priority: rows.find((r) => r.id === companyId)?.data.priority || "B",
        }
      : {}),
    ...row?.data,
    companyId: row?.companyId || companyId || row?.data.companyId || "",
  }));
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const save = useSave();
  const set = (k: string, v: any) => setData((d) => ({ ...d, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const d = { ...data };
      delete d.companyId;
      for (const f of [...fields[kind], ...(kind === "visit" ? detailedVisit : [])])
        if (f.type === "datetime-local" && d[f.key]) d[f.key] = new Date(d[f.key]).toISOString();
      if (d.status === "done" && !d.completedAt) d.completedAt = new Date().toISOString();
      await save.mutateAsync({
        id: row?.id,
        kind: kind as any,
        companyId: kind === "company" ? null : data.companyId,
        data: d,
        allowDuplicate: duplicate,
      });
      close();
    } catch (err: any) {
      setError(err.message || "تعذر الحفظ؛ حاول مرة أخرى");
      if (err.code === "CONFLICT") setShowDuplicate(true);
    }
  }
  function field(f: Field) {
    const val = data[f.key] ?? "";
    return (
      <label key={f.key} className={`field ${f.wide ? "wide" : ""}`}>
        <span>
          {f.label}
          {f.required && <b className="req"> *</b>}
        </span>
        {["company", "visit", "opportunity"].includes(f.type || "") ? (
          <select
            aria-label={f.label}
            required={f.required}
            value={val}
            onChange={(e) => {
              set(f.key, e.target.value);
              if (f.type === "company") {
                set("visitId", "");
                set("opportunityId", "");
                const c = rows.find((r) => r.id === e.target.value);
                if (kind === "visit") {
                  set("customerStatus", c?.data.status || "");
                  set("priority", c?.data.priority || "B");
                }
              }
            }}
          >
            <option value="">اختار {f.type === "company" ? "شركة" : "سجل"}</option>
            {rows
              .filter(
                (r) =>
                  r.kind === f.type && (f.type === "company" || r.companyId === data.companyId),
              )
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.data.name ||
                    r.data.description ||
                    `${r.data.type} — ${r.data.date?.slice(0, 10)}`}
                </option>
              ))}
          </select>
        ) : f.type === "multi" ? (
          <div className="chips">
            {f.options?.map((o) => (
              <button
                type="button"
                className={(val || []).includes(o) ? "chip selected" : "chip"}
                key={o}
                onClick={() =>
                  set(
                    f.key,
                    (val || []).includes(o)
                      ? val.filter((x: string) => x !== o)
                      : [...(val || []), o],
                  )
                }
              >
                {o}
              </button>
            ))}
          </div>
        ) : f.options ? (
          <select aria-label={f.label} value={val} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">اختياري</option>
            {f.options.map((o) => (
              <option key={o} value={o}>
                {labels[o] || o}
              </option>
            ))}
          </select>
        ) : f.type === "textarea" ? (
          <textarea
            aria-label={f.label}
            rows={3}
            value={val}
            required={f.required}
            onChange={(e) => set(f.key, e.target.value)}
          />
        ) : (
          <input
            aria-label={f.label}
            type={f.type || "text"}
            step={f.type === "number" ? "any" : undefined}
            min={
              f.key === "latitude"
                ? -90
                : f.key === "longitude"
                  ? -180
                  : f.type === "number"
                    ? 0
                    : undefined
            }
            max={
              f.key === "latitude"
                ? 90
                : f.key === "longitude"
                  ? 180
                  : f.key === "probability"
                    ? 100
                    : undefined
            }
            value={dt(val, f.type)}
            required={f.required}
            onChange={(e) => set(f.key, e.target.value)}
          />
        )}
      </label>
    );
  }
  return (
    <div className="modal-backdrop">
      <dialog
        open
        className="modal"
        aria-modal="true"
        aria-label={`${row ? "تعديل" : "إضافة"} ${names[kind]}`}
      >
        <header>
          <div>
            <small>
              {kind === "visit"
                ? "تسجيل سريع • التفاصيل الإضافية اختيارية"
                : "بياناتك محفوظة في حسابك"}
            </small>
            <h2>
              {row ? "تعديل" : "إضافة"} {names[kind]}
            </h2>
          </div>
          <button className="icon-btn" onClick={close} aria-label="إغلاق">
            <X size={22} />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="form-body">
            {kind === "visit" && data.companyId && (
              <p className="help">
                المنطقة المسجلة:{" "}
                {areaName(rows.find((r) => r.id === data.companyId) || ({ data: {} } as Row))} —
                التصنيف الحالي: {rows.find((r) => r.id === data.companyId)?.data.status}
              </p>
            )}
            <div className="form-grid">{fields[kind].map(field)}</div>
            {kind === "company" && (
              <div className="contacts-editor">
                <div className="section-heading">
                  <h3>الأشخاص المسؤولون</h3>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() =>
                      set("contacts", [
                        ...(data.contacts || []),
                        { name: "", role: "", phone: "", email: "" },
                      ])
                    }
                  >
                    <Plus size={16} />
                    إضافة شخص
                  </button>
                </div>
                {(data.contacts || []).map((c: any, i: number) => (
                  <div className="contact-edit" key={i}>
                    {["name", "role", "phone", "email"].map((k, j) => (
                      <label className="field" key={k}>
                        <span>{["الاسم", "الوظيفة", "التليفون", "البريد"][j]}</span>
                        <input
                          aria-label={["الاسم", "الوظيفة", "التليفون", "البريد"][j]}
                          type={k === "email" ? "email" : "text"}
                          value={c[k]}
                          onChange={(e) =>
                            set(
                              "contacts",
                              data.contacts.map((x: any, n: number) =>
                                n === i ? { ...x, [k]: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      aria-label="حذف الشخص"
                      className="icon-btn danger"
                      onClick={() =>
                        set(
                          "contacts",
                          data.contacts.filter((_: any, n: number) => n !== i),
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {kind === "visit" && (
              <>
                <div className="visit-suggestion">
                  <strong>اقتراح حسب نتيجة الزيارة</strong>
                  <p>
                    {proposeFollowup(data.outcome).action} • بعد{" "}
                    {proposeFollowup(data.outcome).days} يوم
                  </p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      const suggestion = proposeFollowup(data.outcome);
                      set("nextAction", suggestion.action);
                      set("nextDue", suggestedDate(data.date, suggestion.days));
                    }}
                  >
                    تطبيق الاقتراح وتعديله
                  </button>
                  <small>
                    قاعدة إرشادية، وليست موعدًا متفقًا عليه. لا تُنشأ المتابعة إلا عند الحفظ.
                  </small>
                </div>
                <label className="check">
                  <input
                    aria-label="تحديث تصنيف الشركة وأولويتها"
                    type="checkbox"
                    checked={Boolean(data.updateCompany)}
                    onChange={(e) => set("updateCompany", e.target.checked)}
                  />{" "}
                  تحديث تصنيف الشركة وأولويتها بهذه الزيارة (اختياري)
                </label>
                <p className="help">
                  تحديد خطوة جاية ينشئ متابعة مرتبطة بالزيارة عند حفظ زيارة جديدة. ممكن تسيبها
                  فارغة.
                </p>
                <button type="button" className="expand-btn" onClick={() => setExpanded(!expanded)}>
                  <ChevronDown size={18} /> {expanded ? "إخفاء" : "فتح"} التفاصيل الموسعة
                </button>
                {expanded && (
                  <div className="form-grid detail-fields">{detailedVisit.map(field)}</div>
                )}
              </>
            )}
            {kind === "opportunity" && (
              <p className="help">
                تغيير مرحلة الفرصة لا يغير تصنيف الشركة تلقائيًا. تصنيف «عميل حالي» قرار تسجله بنفسك.
              </p>
            )}
            {error && (
              <div className="error">
                {error}
                {showDuplicate && (
                  <label className="check">
                    <input
                      aria-label="تأكيد إضافة شركة مختلفة"
                      type="checkbox"
                      checked={duplicate}
                      onChange={(e) => setDuplicate(e.target.checked)}
                    />
                    أؤكد أن هذه شركة مختلفة وأريد حفظها رغم التشابه
                  </label>
                )}
              </div>
            )}
          </div>
          <footer>
            <button type="submit" className="primary" disabled={save.isPending}>
              <Save size={18} />
              {save.isPending ? "جاري الحفظ…" : "حفظ البيانات"}
            </button>
            <button type="button" className="secondary" disabled={save.isPending} onClick={close}>
              إلغاء
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
