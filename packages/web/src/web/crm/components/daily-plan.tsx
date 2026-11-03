import { useState, type ReactNode } from "react";
import { MapPin, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { client } from "../lib/api";
import { today, mapLink, labels, type Row } from "../lib/crm";
import { Tag, Empty } from "./workspace-ui";
const ar = (n: number) => n.toLocaleString("ar-EG");
export function DailyPlan({
  stops,
  filter,
  setFilter,
  planDate,
  setPlanDate,
  company,
  companyButton,
  open,
  tools,
  busy,
  q,
  setToast,
  setError,
}: {
  stops: Row[];
  filter: string;
  setFilter: (v: string) => void;
  planDate: string;
  setPlanDate: (v: string) => void;
  company: (id: string | null) => Row | undefined;
  companyButton: (id: string | null) => ReactNode;
  open: (kind: string, row?: Row, cid?: string) => void;
  tools: (row: Row) => ReactNode;
  busy: boolean;
  q: any;
  setToast: (v: string) => void;
  setError: (v: string) => void;
}) {
  const [importBusy, setImportBusy] = useState(false);
  async function swap(a: Row, b: Row) {
    try {
      const list = stops
        .filter((s) => s.data.date === a.data.date)
        .sort((a, b) => Number(a.data.order) - Number(b.data.order));
      const ai = list.findIndex((r) => r.id === a.id),
        bi = list.findIndex((r) => r.id === b.id);
      [list[ai], list[bi]] = [list[bi], list[ai]];
      await client.planning.reorder({ ids: list.map((r) => r.id) });
      await q.invalidateQueries();
    } catch (e: any) {
      setError(e.message);
    }
  }
  const list = stops
    .filter((s) =>
      filter === "upcoming"
        ? s.data.date >= today() && s.data.status === "planned"
        : s.data.date === planDate,
    )
    .sort(
      (a, b) =>
        a.data.date.localeCompare(b.data.date) || Number(a.data.order) - Number(b.data.order),
    );
  return (
    <>
      <div className="toolbar">
        <label className="inline-label">
          يوم الزيارات
          <input
            aria-label="تاريخ خطة الزيارات"
            type="date"
            value={planDate}
            onChange={(e) => {
              setPlanDate(e.target.value);
              setFilter("all");
            }}
          />
        </label>
        <button
          className={`secondary ${filter === "upcoming" ? "active" : ""}`}
          onClick={() => setFilter(filter === "upcoming" ? "all" : "upcoming")}
        >
          كل الزيارات القادمة
        </button>
        <Tag>{ar(list.length)} محطة</Tag>
        <button
          className="text-btn"
          onClick={() => {
            const grouped = [...list].sort((a, b) =>
              (company(a.companyId)?.data.neighborhood || "").localeCompare(
                company(b.companyId)?.data.neighborhood || "",
                "ar",
              ),
            );
            (async () => {
              try {
                setImportBusy(true);
                await client.planning.reorder({ ids: grouped.map((r) => r.id) });
                await q.invalidateQueries();
                setToast("تم الترتيب حسب الحي");
              } catch (e: any) {
                setError(e.message);
              } finally {
                setImportBusy(false);
              }
            })();
          }}
          disabled={importBusy || filter === "upcoming"}
        >
          تجميع حسب الحي
        </button>
      </div>
      <div className="plan-list">
        {list.map((s, i) => {
          const c = company(s.companyId);
          return (
            <article className="panel stop-card" key={s.id}>
              <div className="stop-number">{ar(i + 1)}</div>
              <div className="stop-content">
                {companyButton(s.companyId)}
                <p>
                  <MapPin size={15} />
                  {[c?.data.address, c?.data.neighborhood, c?.data.city]
                    .filter(Boolean)
                    .join("، ") || "العنوان غير مسجل"}
                </p>
                <div className="meta">
                  <span>
                    {s.data.date} {s.data.time}
                  </span>
                  <Tag tone={s.data.status === "completed" ? "teal" : "neutral"}>
                    {labels[s.data.status]}
                  </Tag>
                </div>
                {s.data.objective && <p>{s.data.objective}</p>}
              </div>
              <div className="stop-actions">
                {c && (
                  <a className="secondary" href={mapLink(c)} target="_blank" rel="noreferrer">
                    <MapPin size={17} />
                    اتجاهات
                  </a>
                )}
                <button
                  className="primary"
                  onClick={() => open("visit", undefined, s.companyId || "")}
                >
                  <Plus size={17} />
                  سجّل الزيارة
                </button>
                <div className="row-tools">
                  <button
                    className="icon-btn"
                    aria-label="تقديم المحطة"
                    disabled={i === 0 || busy || filter === "upcoming"}
                    onClick={() => swap(s, list[i - 1])}
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="تأخير المحطة"
                    disabled={i === list.length - 1 || busy || filter === "upcoming"}
                    onClick={() => swap(s, list[i + 1])}
                  >
                    <ArrowDown size={17} />
                  </button>
                  {tools(s)}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!list.length && (
        <section className="panel">
          <Empty
            title="يومك لسه فاضي"
            text="اختار الشركات ورتب محطاتك. الاتجاهات تفتح في Google Maps بدون API مدفوع."
            action="إضافة محطة زيارة"
            onClick={() => open("stop")}
          />
        </section>
      )}
      <p className="help">
        الترتيب يدوي أو حسب الحي؛ التخطيط الجغرافي أعلاه اقتراح بالمسافة المباشرة وليس طريق القيادة.
        بعد الزيارة عدّل المحطة إلى «تمت».
      </p>
    </>
  );
}
