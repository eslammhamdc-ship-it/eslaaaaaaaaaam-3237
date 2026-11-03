import { TrendingUp, ArrowLeft } from "lucide-react";
import { dateKey, stages, statuses, services, type Row } from "../lib/crm";
import { areaName, linkedVisits } from "../lib/intelligence";
export function PerformanceInsights({
  rows,
  from,
  to,
  companyId = "",
  area = "",
  open,
}: {
  rows: Row[];
  from: string;
  to: string;
  companyId?: string;
  area?: string;
  open: (kind: string, row?: Row, cid?: string) => void;
}) {
  if (
    !from ||
    !to ||
    !Number.isFinite(Date.parse(from)) ||
    !Number.isFinite(Date.parse(to)) ||
    from > to
  )
    return <p className="error">اختر فترة صحيحة: البداية لا تتجاوز النهاية.</p>;
  const cs = rows.filter((r) => r.kind === "company"),
    matches = (id: string | null) => {
      const c = cs.find((c) => c.id === id);
      return (
        (!companyId || id === companyId) &&
        (!area || [c?.data.city, c?.data.neighborhood].includes(area))
      );
    };
  const all = rows.filter((r) => r.kind === "visit" && matches(r.companyId)),
    os = rows.filter((r) => r.kind === "opportunity" && matches(r.companyId));
  const vs = all.filter((v) => dateKey(v.data.date) >= from && dateKey(v.data.date) <= to);
  const duration = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const prevEnd = new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10),
    prevStart = new Date(Date.parse(from) - duration * 86400000).toISOString().slice(0, 10);
  const prev = all.filter(
    (v) => dateKey(v.data.date) >= prevStart && dateKey(v.data.date) <= prevEnd,
  );
  const linked = linkedVisits(vs, os);
  const groups = new Map<string, { visits: number; linked: number }>();
  for (const v of vs) {
    const c = cs.find((c) => c.id === v.companyId);
    const key = c ? areaName(c) : "غير مسجل";
    const x = groups.get(key) || { visits: 0, linked: 0 };
    x.visits++;
    if (linked.some((l) => l.id === v.id)) x.linked++;
    groups.set(key, x);
  }
  const productive = [...groups.entries()].sort(
    (a, b) => b[1].linked - a[1].linked || b[1].visits - a[1].visits,
  );
  const active = cs.filter(
    (c) => c.data.status === statuses[1] && vs.some((v) => v.companyId === c.id),
  );
  const reasons = vs.filter((v) => v.data.objections || v.data.feedback || v.data.needs);
  const demand = services
    .map((s) => ({ name: s, n: vs.filter((v) => (v.data.services || []).includes(s)).length }))
    .sort((a, b) => b.n - a.n);
  return (
    <section className="insights-section section-gap">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PERFORMANCE SIGNALS</span>
          <h3>قراءة الأداء، مش مجرد أرقام</h3>
          <p>حقائق مسجلة؛ الربط بفرصة لا يُثبت حدوث بيع أو أن الزيارة سببت التحويل.</p>
        </div>
        <TrendingUp size={23} />
      </div>
      <div className="command-stats">
        <article>
          <div>
            <strong>{vs.length.toLocaleString("ar-EG")}</strong>
            <span>زيارات الفترة الحالية</span>
          </div>
        </article>
        <article>
          <div>
            <strong>{prev.length.toLocaleString("ar-EG")}</strong>
            <span>الفترة السابقة بنفس المدة</span>
          </div>
        </article>
        <article>
          <div>
            <strong>
              {prev.length
                ? `${Math.round(((vs.length - prev.length) / prev.length) * 100)}%`
                : "—"}
            </strong>
            <span>{prev.length ? "تغير عدد الزيارات" : "لا أساس كافٍ لمقارنة نسبة"}</span>
          </div>
        </article>
        <article>
          <div>
            <strong>{vs.length ? `${Math.round((linked.length / vs.length) * 100)}%` : "—"}</strong>
            <span>زيارات مرتبطة بفرص مسجلة</span>
          </div>
        </article>
      </div>
      <div className="report-grid">
        <section className="panel">
          <h3>المناطق الأكثر إنتاجية</h3>
          <p className="help">الترتيب بعدد الزيارات المرتبطة بفرص، ثم عدد الزيارات. ليس إيرادات.</p>
          {productive.map(([name, x]) => (
            <div className="bar-row" key={name}>
              <span>{name}</span>
              <div className="bar-track">
                <i style={{ width: `${vs.length ? (x.visits / vs.length) * 100 : 0}%` }} />
              </div>
              <b>
                {x.linked}/{x.visits}
              </b>
            </div>
          ))}
          {!productive.length && <p className="help">لا توجد زيارات في الفترة المحددة.</p>}
        </section>
        <section className="panel">
          <h3>الخدمات التي أبدى العملاء اهتمامًا بها</h3>
          {demand.map((x) => (
            <div className="bar-row" key={x.name}>
              <span>{x.name}</span>
              <div className="bar-track">
                <i style={{ width: `${vs.length ? (x.n / vs.length) * 100 : 0}%` }} />
              </div>
              <b>{x.n}</b>
            </div>
          ))}
        </section>
        <section className="panel">
          <h3>شركات زرتها وتصنيفها الحالي «عميل حالي»</h3>
          <p className="help">تصنيفك المسجل، وليس إثبات تعامل مالي أو تحويل بسبب زيارة.</p>
          {active.map((c) => (
            <div className="gap-row" key={c.id}>
              <strong>{c.data.name}</strong>
              <button className="text-btn" onClick={() => open("followup", undefined, c.id)}>
                تابع العلاقة <ArrowLeft size={15} />
              </button>
            </div>
          ))}
          {!active.length && <p className="help">لا توجد سجلات مطابقة.</p>}
        </section>
        <section className="panel">
          <h3>أصوات العملاء: الاحتياجات والاعتراضات</h3>
          {reasons.slice(0, 8).map((v) => (
            <div className="report-item" key={v.id}>
              <strong>{cs.find((c) => c.id === v.companyId)?.data.name}</strong>
              <p>{v.data.objections && `اعتراض مسجل: ${v.data.objections}`}</p>
              <p>{v.data.feedback && `رأي العميل: ${v.data.feedback}`}</p>
              <p>{v.data.needs && `الاحتياج: ${v.data.needs}`}</p>
              <button className="text-btn" onClick={() => open("visit", v)}>
                راجع الزيارة <ArrowLeft size={14} />
              </button>
            </div>
          ))}
          {!reasons.length && (
            <p className="help">
              سجّل احتياجات العميل واعتراضاته في تفاصيل الزيارة. لا نستنتج أسبابًا غير مسجلة.
            </p>
          )}
        </section>
      </div>
      <section className="panel section-gap">
        <h3>فرص تستحق التدخل</h3>
        <p className="help">
          كل الفرص المفتوحة المطابقة للشركة والمنطقة، بصرف النظر عن الفترة المحددة.
        </p>
        {os
          .filter(
            (o) =>
              ![stages[6], stages[7]].includes(o.data.stage) &&
              (o.data.obstacle || o.data.nextAction),
          )
          .slice(0, 6)
          .map((o) => (
            <div className="gap-row" key={o.id}>
              <div>
                <strong>{o.data.description}</strong>
                <p className="help">
                  {o.data.obstacle
                    ? `عائق مسجل: ${o.data.obstacle}`
                    : `الخطوة المسجلة: ${o.data.nextAction}`}
                </p>
              </div>
              <button className="text-btn" onClick={() => open("opportunity", o)}>
                راجع الفرصة <ArrowLeft size={15} />
              </button>
            </div>
          ))}
        {!os.some(
          (o) =>
            ![stages[6], stages[7]].includes(o.data.stage) &&
            (o.data.obstacle || o.data.nextAction),
        ) && <p className="help">لا توجد فرصة مفتوحة بعائق أو خطوة مسجلة ضمن الفلتر.</p>}
      </section>
      <p className="help">
        المقارنة السابقة: {prevStart} إلى {prevEnd} • مناطق الزيارات تعتمد على عنوان الشركة الحالي.
      </p>
    </section>
  );
}
