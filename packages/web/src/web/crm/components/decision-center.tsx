import { ArrowLeft, Compass, Target, CalendarDays, Building2 } from "lucide-react";
import { decisions, linkedVisits } from "../lib/intelligence";
import { today, statuses, type Row } from "../lib/crm";
export function DecisionCenter({
  rows,
  open,
  go,
}: {
  rows: Row[];
  open: (kind: string, row?: Row, cid?: string) => void;
  go: (page: string, filter?: string) => void;
}) {
  const items = decisions(rows),
    cs = rows.filter((r) => r.kind === "company"),
    vs = rows.filter((r) => r.kind === "visit"),
    os = rows.filter((r) => r.kind === "opportunity");
  const linked = linkedVisits(vs, os);
  const planned = rows.filter(
    (r) => r.kind === "stop" && r.data.date === today() && r.data.status === "planned",
  );
  return (
    <>
      <div className="command-stats">
        <button onClick={() => go("plan")}>
          <CalendarDays size={19} />
          <div>
            <strong>{planned.length.toLocaleString("ar-EG")}</strong>
            <span>زيارات مخططة اليوم</span>
          </div>
        </button>
        <button onClick={() => go("companies", statuses[0])}>
          <Building2 size={19} />
          <div>
            <strong>
              {cs.filter((c) => c.data.status === statuses[0]).length.toLocaleString("ar-EG")}
            </strong>
            <span>عملاء محتملون</span>
          </div>
        </button>
        <button onClick={() => go("companies", "priorityA")}>
          <Target size={19} />
          <div>
            <strong>
              {cs.filter((c) => c.data.priority === "A").length.toLocaleString("ar-EG")}
            </strong>
            <span>شركات أولوية A</span>
          </div>
        </button>
        <button onClick={() => go("visits", "linked")}>
          <Target size={19} />
          <div>
            <strong>
              {vs.length
                ? `${Math.round((linked.length / vs.length) * 100).toLocaleString("ar-EG")}٪`
                : "—"}
            </strong>
            <span>
              زيارات مرتبطة بفرص ({linked.length}/{vs.length})
            </span>
          </div>
        </button>
      </div>
      <section className="panel decision-center">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DAILY BRIEFING</span>
            <h3>
              <Compass size={21} />
              ماذا أفعل الآن؟
            </h3>
            <p>اقتراحات بقواعد واضحة من بياناتك، وليست AI أو تعليمات تُنفذ تلقائيًا.</p>
          </div>
          <span className="tag teal">
            {items.length ? `${items.length} خطوات مقترحة` : "بانتظار سجلاتك"}
          </span>
        </div>
        {items.length ? (
          <div className="decision-grid">
            {items.map((item, i) => (
              <button
                className="decision-item"
                key={i}
                onClick={() =>
                  item.kind === "plan" ? go("plan") : open(item.kind, item.row, item.companyId)
                }
              >
                <span className="decision-number">0{i + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.reason}</p>
                </div>
                <ArrowLeft size={17} />
              </button>
            ))}
          </div>
        ) : (
          <div className="decision-empty">
            <p>أضف شركاتك وسجّل نتائج الزيارات والمواعيد لتظهر أولويات يومك هنا.</p>
            <button className="primary" onClick={() => open("company")}>
              إضافة أول شركة <ArrowLeft size={16} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}
