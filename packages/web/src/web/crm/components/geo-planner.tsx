import { useState, useCallback } from "react";
import { ArrowUp, ArrowDown, X, Plus, MapPin } from "lucide-react";
import { type Row, today, mapLink, services } from "../lib/crm";
import { areaName, areaGroups, clusters, point, routeOrder, routeKm } from "../lib/intelligence";
import { CompanyMap } from "./company-map";
import { useAppendPlan } from "../queries/planning";
export function GeoPlanner({
  rows,
  open,
  date,
  onDate,
}: {
  rows: Row[];
  open: (kind: string, row?: Row, cid?: string) => void;
  date: string;
  onDate: (date: string) => void;
}) {
  const [service, setService] = useState("");
  const [search, setSearch] = useState(""),
    [priority, setPriority] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [start, setStart] = useState(""),
    [time, setTime] = useState("09:00");
  const save = useAppendPlan();
  const companies = rows.filter((r) => r.kind === "company"),
    os = rows.filter((r) => r.kind === "opportunity");
  const matches = companies.filter(
    (c) =>
      [c.data.name, c.data.address, c.data.neighborhood, c.data.city, c.data.governorate]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!priority || c.data.priority === priority) &&
      (!status || c.data.status === status) &&
      (!service || (c.data.neededServices || []).includes(service)),
  );
  const draft = selected
    .map((id) => companies.find((c) => c.id === id))
    .filter((c): c is Row => Boolean(c));
  const groups = areaGroups(matches, os),
    near = clusters(matches);
  const toggle = useCallback(
    (id: string) =>
      setSelected((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id])),
    [],
  );
  function move(i: number, step: number) {
    setSelected((ids) => {
      const next = [...ids];
      [next[i], next[i + step]] = [next[i + step], next[i]];
      return next;
    });
  }
  function propose() {
    let ordered = routeOrder(
      draft,
      point(companies.find((c) => c.id === start) || ({ data: {} } as Row)) || undefined,
    );
    ordered = ordered
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const rank = (c: Row) =>
          c.data.closesAt && c.data.closesAt < time
            ? 2
            : c.data.opensAt && c.data.opensAt > time
              ? 1
              : 0;
        return rank(a.c) - rank(b.c) || a.i - b.i;
      })
      .map((x) => x.c);
    setSelected(ordered.map((c) => c.id));
    setMessage(
      "ترتيب إرشادي بالمسافة المباشرة والأولوية، ثم ساعات العمل المسجلة عند وقت البداية. راجع المواعيد يدويًا؛ لا توجد أزمنة طريق.",
    );
  }
  async function commit() {
    setMessage("");
    try {
      const result = await save.mutateAsync({ date, companyIds: selected });
      setMessage(
        `تمت إضافة ${result.added} محطة؛ تخطي ${result.skipped} مخطط لها بالفعل في نفس اليوم.`,
      );
      setSelected([]);
    } catch (e: any) {
      setMessage(e.message || "تعذر حفظ الخطة");
    }
  }
  return (
    <section className="geo-planner">
      <div className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TERRITORY PLANNER</span>
            <h3>اختر المنطقة، وابنِ يومك</h3>
            <p className="help">الشركات من قاعدة بياناتك فقط — لا بحث خارجي أو عناوين مُولّدة.</p>
          </div>
          <button className="secondary" onClick={() => open("company")}>
            <Plus size={16} />
            إضافة شركة
          </button>
        </div>
        <div className="toolbar">
          <input
            aria-label="بحث منطقة أو شارع أو شركة"
            placeholder="محافظة، مدينة، حي، شارع أو شركة…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="أولوية التخطيط"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">كل الأولويات</option>
            {["A", "B", "C"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            aria-label="خدمة مطلوبة للتخطيط"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <option value="">كل الخدمات المطلوبة</option>
            {services.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="تصنيف شركات التخطيط"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">كل التصنيفات</option>
            {[...new Set(companies.map((c) => c.data.status))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="planner-summary">
          <span>{matches.length} شركة مستهدفة</span>
          <span>{near.filter((g) => g.length > 1).length} تجمع قريب (روابط ≤ ١ كم)</span>
          <span>{draft.length} زيارة في المسودة</span>
        </div>
        <div className="area-suggestions">
          {groups.slice(0, 5).map((g) => (
            <button
              key={g.name}
              className="area-option"
              onClick={() =>
                setSelected((ids) => [...new Set([...ids, ...g.companies.map((c) => c.id)])])
              }
            >
              <strong>{g.name}</strong>
              <small>
                {g.companies.length} شركة • {g.priority} أولوية A • {g.open} فرصة مفتوحة
              </small>
              <span>أضف {g.companies.length} زيارة مقترحة</span>
            </button>
          ))}
        </div>
        <p className="help">
          ترتيب المناطق = عدد الشركات + ٢ × أولوية A + ٢ × الفرص المفتوحة. التجمعات روابط قرب جغرافي
          وليست أحياء أو اكتشاف شركات جديدة.
        </p>
      </div>
      {near.some((g) => g.length > 1) && (
        <section className="panel">
          <h3>تجمعات جغرافية من مواقع مؤكدة</h3>
          <div className="area-suggestions">
            {near
              .filter((g) => g.length > 1)
              .slice(0, 6)
              .map((g, i) => (
                <button
                  key={g[0].id}
                  className="area-option"
                  onClick={() =>
                    setSelected((ids) => [...new Set([...ids, ...g.map((c) => c.id)])])
                  }
                >
                  <strong>
                    تجمع {i + 1} — {g.length} شركات
                  </strong>
                  <small>{g.map((c) => c.data.name).join("، ")}</small>
                  <span>أضف التجمع للمسودة</span>
                </button>
              ))}
          </div>
          <p className="help">
            كل شركة متصلة بأخرى ضمن ١ كم؛ قد يكون طول التجمع كله أكبر من ١ كم. لا تُضم شركات بلا
            إحداثيات.
          </p>
        </section>
      )}
      <CompanyMap companies={matches} draft={draft} onSelect={toggle} />
      <div className="planner-columns">
        <section className="panel">
          <div className="section-heading">
            <h3>الشركات المطابقة ({matches.length})</h3>
            <button
              className="text-btn"
              disabled={!matches.length}
              onClick={() =>
                setSelected((ids) => [...new Set([...ids, ...matches.map((c) => c.id)])])
              }
            >
              أضف النتائج للمسودة
            </button>
          </div>
          <div className="planner-companies">
            {matches.map((c) => (
              <article className="planner-company" key={c.id}>
                <label className="check">
                  <input
                    aria-label={`اختيار ${c.data.name}`}
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <strong>{c.data.name}</strong>
                </label>
                <p>
                  {areaName(c)} • {c.data.status} • أولوية {c.data.priority}
                </p>
                <p>
                  {c.data.address || "العنوان غير مسجل"} • {c.data.phone || "الهاتف غير مسجل"}
                </p>
                <p>{(c.data.neededServices || []).join("، ") || "الخدمات المطلوبة غير مسجلة"}</p>
                <small>
                  {point(c) ? "إحداثيات مؤكدة" : "بدون إحداثيات — لا نحسب مسافة"}
                  {c.data.opensAt &&
                    ` • العمل ${c.data.opensAt} — ${c.data.closesAt || "غير معروف"}`}
                </small>
                <div className="row-tools">
                  <button className="text-btn" onClick={() => open("company", c)}>
                    تعديل البيانات والموقع
                  </button>
                  <a href={mapLink(c)} target="_blank" rel="noreferrer" className="text-btn">
                    <MapPin size={14} />
                    اتجاهات
                  </a>
                </div>
              </article>
            ))}
          </div>
          {!matches.length && (
            <p className="help">
              لا توجد شركات مسجلة تطابق المنطقة. أضف شركة من مصدر موثوق أو استورد CSV من التحليلات ←
              البيانات. لا توجد خدمة بحث عن شركات أو تحويل عنوان إلى إحداثيات تلقائيًا.
            </p>
          )}
        </section>
        <section className="panel draft-panel">
          <h3>مسودة خطة اليوم ({draft.length})</h3>
          <div className="form-grid">
            <label className="field">
              <span>يوم الخطة</span>
              <input
                aria-label="يوم المسودة"
                type="date"
                value={date || today()}
                onChange={(e) => onDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span>وقت البداية للمراجعة</span>
              <input
                aria-label="وقت بداية المسودة"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
            <label className="field wide">
              <span>ابدأ قرب موقع شركة — اختياري</span>
              <select
                aria-label="نقطة بداية المسار"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              >
                <option value="">أعلى أولوية أولًا</option>
                {companies
                  .filter((c) => point(c))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.data.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <button className="secondary" disabled={!draft.length} onClick={propose}>
            اقترح ترتيبًا جغرافيًا
          </button>
          <p className="help">
            {routeKm(draft).toFixed(1)} كم بين النقاط المتتالية المتاحة فقط (خط مستقيم؛ ليس مسافة
            قيادة). المجهولة لا تدخل الحساب.
          </p>
          {draft.map((c, i) => (
            <div className="draft-stop" key={c.id}>
              <b>{i + 1}</b>
              <div>
                <strong>{c.data.name}</strong>
                <small>
                  {areaName(c)}
                  {c.data.closesAt && c.data.closesAt < time
                    ? " • ساعات العمل المسجلة انتهت عند وقت البداية"
                    : ""}
                  {c.data.opensAt && c.data.opensAt > time ? " • يفتح بعد وقت البداية" : ""}
                </small>
              </div>
              <button
                className="icon-btn"
                aria-label={`تقديم ${c.data.name}`}
                disabled={!i}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={15} />
              </button>
              <button
                className="icon-btn"
                aria-label={`تأخير ${c.data.name}`}
                disabled={i === draft.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={15} />
              </button>
              <button
                className="icon-btn danger"
                aria-label={`استبعاد ${c.data.name}`}
                onClick={() => toggle(c.id)}
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <button
            className="primary"
            disabled={!draft.length || draft.length > 100 || !date || save.isPending}
            onClick={commit}
          >
            {save.isPending ? "جاري الحفظ…" : "حفظ المسودة في خطة اليوم"}
          </button>
          {message && <output className="planner-message">{message}</output>}
          <p className="help">
            حد المسودة ١٠٠ شركة لكل حفظ. الحفظ يضيف المحطات دفعة واحدة ولا يستبدل خطتك. لا يكرر الشركة
            المخططة في نفس اليوم. عدّل مواعيد وهدف المحطات بعد الحفظ.
          </p>
        </section>
      </div>
    </section>
  );
}
