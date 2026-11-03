import { DailyPlan } from "../components/daily-plan";
import { GeoPlanner } from "../components/geo-planner";
import { DecisionCenter } from "../components/decision-center";
import { PerformanceInsights } from "../components/performance-insights";
import { linkedVisits } from "../lib/intelligence";
import { Tag, Empty } from "../components/workspace-ui";
import { ActionGaps, CalendarExport } from "../components/sales-tools";
import { useState, useEffect } from "react";
import baseTheme from "../base.css?raw";
import premiumTheme from "../premium.css?raw";
const theme = baseTheme + "\n" + premiumTheme;
import { Link } from "wouter";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  CalendarClock,
  GitBranch,
  MapPin,
  BarChart3,
  Plus,
  Search,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  AlertCircle,
  Download,
  Upload,
  LogOut,
  Phone,
  Mail,
  ExternalLink,
  Trash2,
  Pencil,
  CalendarDays,
  Menu,
  CheckCircle2,
  RefreshCw,
  FileText,
  ShieldCheck,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "../lib/auth";
import { client } from "../lib/api";
import { useRecords, useSave, useRemove } from "../queries/crm";
import { RecordForm } from "../components/record-form";
import {
  statuses,
  stages,
  services,
  visitTypes,
  outcomes,
  today,
  dateKey,
  fmt,
  dueState,
  mapLink,
  download,
  csv,
  parseCSV,
  defaults,
  type Row,
} from "../lib/crm";
const nav = [
  { id: "dashboard", label: "لوحة المتابعة", icon: LayoutDashboard },
  { id: "companies", label: "الشركات والعملاء", icon: Building2 },
  { id: "visits", label: "سجل الزيارات", icon: ClipboardList },
  { id: "followups", label: "المتابعات", icon: CalendarClock },
  { id: "plan", label: "خطة الزيارات والخريطة", icon: MapPin },
  { id: "reports", label: "التحليلات", icon: BarChart3 },
];
const titles: Record<string, string> = {
  dashboard: "صورة واضحة لشغلك",
  companies: "الشركات والعملاء",
  visits: "سجل الزيارات",
  followups: "كل متابعة، في وقتها",
  pipeline: "من أول تواصل لشغل حقيقي",
  plan: "رتّب يومك الميداني",
  reports: "التحليلات والفرص",
};
const subtitles: Record<string, string> = {
  dashboard: "زياراتك، متابعاتك، وفرصك — بدون ما يفوتك شيء.",
  companies: "كل شركة، والأشخاص اللي بيصنعوا القرار.",
  visits: "ارجع لكل مقابلة، واللي اتفقتوا عليه.",
  followups: "خطوات واضحة تحافظ على العلاقة وتحرّك البيع.",
  pipeline: "تابع تقدم العلاقات والفرص خطوة بخطوة.",
  plan: "محطات مرتبة وعناوين جاهزة قبل ما تنزل.",
  reports: "قرارات مبنية على سجلاتك، ونسخة احتياطية تحت إيدك.",
};
type FormSpec = { kind: string; row?: Row; companyId?: string };
const ar = (n: number) => n.toLocaleString("ar-EG");
function stateTone(s: string) {
  return s === "overdue" ? "red" : s === "today" ? "amber" : s === "done" ? "teal" : "neutral";
}
const stateLabels: Record<string, string> = {
  overdue: "متأخرة",
  today: "النهارده",
  upcoming: "قادمة",
  done: "مكتملة",
  unscheduled: "بدون موعد",
};
export default function Workspace() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = theme;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  const { data: session } = authClient.useSession();
  const query = useRecords();
  const save = useSave();
  const remove = useRemove();
  const q = useQueryClient();
  const [analyticsTab, setAnalyticsTab] = useState("performance");
  const [page, setPage] = useState("dashboard");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState<FormSpec | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [menu, setMenu] = useState(false);
  const [area, setArea] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState("recent");
  const [planDate, setPlanDate] = useState(today());
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());
  const [reportArea, setReportArea] = useState("");
  const [reportCompany, setReportCompany] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const rows = (query.data || []) as Row[];
  const companies = rows.filter((r) => r.kind === "company");
  const visits = rows.filter((r) => r.kind === "visit");
  const tasks = rows.filter((r) => r.kind === "followup");
  const opportunities = rows.filter((r) => r.kind === "opportunity");
  const stops = rows.filter((r) => r.kind === "stop");
  const company = (id: string | null) => companies.find((r) => r.id === id);
  const cname = (id: string | null) => company(id)?.data.name || "شركة غير متاحة";
  const current = company(selected);
  const busy = save.isPending || remove.isPending;
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function go(p: string, f = "all") {
    setPage(p === "pipeline" ? "reports" : p);
    if (p === "pipeline") setAnalyticsTab("pipeline");
    setFilter(f);
    setSearch("");
    setSelected("");
    setArea("");
    setPriority(f === "priorityA" ? "A" : "");
    if (f === "priorityA") setFilter("all");
    setMenu(false);
  }
  function open(kind: string, row?: Row, cid?: string) {
    if (row && !editable(row)) {
      setError("تعديل هذا السجل للمدير المسؤول أو صاحبه");
      return;
    }
    setForm({ kind, row, companyId: cid });
    setError("");
  }
  async function update(r: Row, patch: Record<string, any>) {
    setError("");
    try {
      await save.mutateAsync({
        id: r.id,
        kind: r.kind as any,
        companyId: r.companyId,
        data: { ...r.data, ...patch },
        allowDuplicate: true,
      });
      setToast("تم حفظ التغيير");
    } catch (e: any) {
      setError(e.message || "تعذر الحفظ");
    }
  }
  async function del() {
    if (!confirm) return;
    try {
      await remove.mutateAsync({ id: confirm.id });
      if (selected === confirm.id) setSelected("");
      setConfirm(null);
      setToast("تم حذف السجل");
    } catch (e: any) {
      setError(e.message);
      setConfirm(null);
    }
  }
  const overdue = tasks.filter((t) => dueState(t) === "overdue");
  const todayTasks = tasks.filter((t) => dueState(t) === "today");
  const queryMatch = (r: Row) =>
    JSON.stringify({ ...r.data, company: cname(r.companyId) })
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase());
  function metric(
    label: string,
    value: number | string,
    detail: string,
    target: string,
    f: string,
    tone = "teal",
  ) {
    return (
      <button className={`metric ${tone}`} onClick={() => go(target, f)}>
        <span>
          {label}
          <ArrowLeft size={16} />
        </span>
        <strong>{typeof value === "number" ? ar(value) : value}</strong>
        <small>{detail}</small>
      </button>
    );
  }
  const editable = (r: Row) =>
    ["branch_manager", "sales_manager"].includes(session.user.role) ||
    r.ownerId === session.user.id;
  function tools(r: Row) {
    if (!editable(r)) return null;
    return (
      <div className="row-tools">
        <button
          className="icon-btn"
          aria-label="تعديل السجل"
          title="تعديل"
          onClick={() => open(r.kind, r)}
        >
          <Pencil size={16} />
        </button>
        <button
          className="icon-btn danger"
          aria-label="حذف السجل"
          title="حذف"
          disabled={r.kind === "company" && session.user.role !== "branch_manager"}
          onClick={() => setConfirm(r)}
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  }
  function companyButton(id: string | null) {
    return (
      <button
        className="company-link"
        onClick={() => {
          setSelected(id || "");
          setPage("companies");
        }}
      >
        {cname(id)}
      </button>
    );
  }
  function taskCard(t: Row) {
    const s = dueState(t);
    return (
      <article className={`task-card ${s}`} key={t.id}>
        <div className="task-mark">
          {s === "done" ? (
            <CheckCircle2 size={20} />
          ) : s === "overdue" ? (
            <AlertCircle size={20} />
          ) : (
            <Clock size={20} />
          )}
        </div>
        <div className="task-content">
          {companyButton(t.companyId)}
          <h4>{t.data.action}</h4>
          <div className="meta">
            <span>{fmt(t.data.due, true)}</span>
            <span>{t.data.channel}</span>
            {t.data.contact && <span>{t.data.contact}</span>}
            <Tag tone={stateTone(s)}>{stateLabels[s]}</Tag>
            <Tag>أولوية {t.data.priority || "B"}</Tag>
          </div>
          {t.data.completionNotes && <p>{t.data.completionNotes}</p>}
        </div>
        <div className="task-actions">
          {s !== "done" && (
            <button
              title="إتمام المتابعة"
              aria-label="إتمام المتابعة"
              className="icon-btn complete"
              disabled={busy}
              onClick={() => update(t, { status: "done", completedAt: new Date().toISOString() })}
            >
              <Check size={20} />
            </button>
          )}
          {s === "done" && (
            <button
              title="متابعة جديدة"
              className="icon-btn"
              onClick={() => open("followup", undefined, t.companyId || "")}
            >
              <Plus size={18} />
            </button>
          )}
          {tools(t)}
        </div>
      </article>
    );
  }
  function dashboard() {
    const now = today();
    const d = new Date(now + "T12:00:00");
    const wd = d.getDay();
    d.setDate(d.getDate() - ((wd + 1) % 7));
    const week = d.toISOString().slice(0, 10);
    const month = now.slice(0, 7);
    const monthVisits = visits.filter(
      (v) => dateKey(v.data.date).startsWith(month) && dateKey(v.data.date) <= now,
    );
    const won = opportunities.filter((o) => o.data.stage === stages[6]);
    const lost = opportunities.filter((o) => o.data.stage === stages[7]);
    const active = companies.filter((c) => c.data.status === statuses[1]);
    return (
      <>
        <DecisionCenter rows={rows} open={open} go={go} />
        <section className="welcome-strip">
          <div>
            <span className="eyebrow">نظرة اليوم</span>
            <h2>أهلًا {session?.user.name?.split(" ")[0] || "بيك"}، جاهز للزيارة الجاية؟</h2>
            <p>
              {overdue.length
                ? `عندك ${ar(overdue.length)} متابعة متأخرة محتاجة اهتمام.`
                : todayTasks.length
                  ? `عندك ${ar(todayTasks.length)} متابعة مستنياك النهارده.`
                  : "كل خطوة بتسجلها النهارده بتسهّل المتابعة بكرة."}
            </p>
          </div>
          <button className="primary" onClick={() => open("visit")}>
            <Plus size={19} />
            تسجيل زيارة سريعة
          </button>
        </section>
        <div className="metrics-grid">
          {metric("عملاء حاليون", active.length, "حسب التصنيف المسجل", "companies", statuses[1])}
          {metric(
            "فرص مفتوحة",
            opportunities.filter((o) => ![stages[6], stages[7]].includes(o.data.stage)).length,
            "فرص تحتاج خطوة قادمة",
            "pipeline",
            "open",
          )}
          {metric(
            "زيارات النهارده",
            visits.filter((v) => dateKey(v.data.date) === now).length,
            "الزيارات المسجلة اليوم",
            "visits",
            "today",
          )}
          {metric(
            "زيارات الأسبوع",
            visits.filter((v) => dateKey(v.data.date) >= week && dateKey(v.data.date) <= now)
              .length,
            "الأسبوع يبدأ السبت",
            "visits",
            "week",
          )}
          {metric(
            "زيارات الشهر",
            monthVisits.length,
            "من أول الشهر حتى النهارده",
            "visits",
            "month",
          )}
          {metric(
            "متابعات متأخرة",
            overdue.length,
            "محتاجة خطوة منك",
            "followups",
            "overdue",
            "red",
          )}
          {metric(
            "متابعات النهارده",
            todayTasks.length,
            "مواعيدك لليوم",
            "followups",
            "today",
            "amber",
          )}
          {metric(
            "زيارات قادمة",
            stops.filter((s) => s.data.date >= now && s.data.status === "planned").length,
            "محطات مخطط لها",
            "plan",
            "upcoming",
          )}
        </div>
        <div className="dashboard-columns">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h3>متابعات تستحق اهتمامك</h3>
                <p>المتأخر أولًا، ثم مواعيد النهارده</p>
              </div>
              <button className="text-btn" onClick={() => go("followups")}>
                كل المتابعات <ArrowLeft size={15} />
              </button>
            </div>
            {[...overdue, ...todayTasks].slice(0, 4).map(taskCard)}
            {!overdue.length && !todayTasks.length && (
              <Empty
                title="مفيش متابعات مستحقة"
                text="أضف خطوة واضحة بعد كل زيارة عشان ما تفوتش فرصة."
                action="إضافة متابعة"
                onClick={() => open("followup")}
              />
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h3>آخر الزيارات</h3>
                <p>نتائج المقابلات والخطوة اللي بعدها</p>
              </div>
              <button className="text-btn" onClick={() => go("visits")}>
                عرض الكل <ArrowLeft size={15} />
              </button>
            </div>
            {[...visits]
              .sort((a, b) => b.data.date.localeCompare(a.data.date))
              .slice(0, 4)
              .map((v) => (
                <div key={v.id} className="visit-preview">
                  <div className="mini-icon">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    {companyButton(v.companyId)}
                    <small>
                      {fmt(v.data.date)} · {v.data.type}
                    </small>
                    <p>{v.data.outcome}</p>
                    {v.data.nextAction && (
                      <span className="next-text">الخطوة الجاية: {v.data.nextAction}</span>
                    )}
                  </div>
                </div>
              ))}
            {!visits.length && (
              <Empty
                title="أول زيارة، أول خطوة"
                text="سجّل مقابلاتك بسرعة، وارجع للتفاصيل وقت ما تحتاج."
                action="تسجيل زيارة"
                onClick={() => open("visit")}
              />
            )}
          </section>
        </div>
        <details className="dashboard-details section-gap">
          <summary>صحة العلاقات وفرص البيع — عرض التفاصيل</summary>
          <p className="help">التصنيف يتغير بقرار منك، مش بمجرد تسجيل زيارة.</p>
          <div className="metrics-grid secondary-metrics">
            {metric(
              "عملاء محتملون جدد",
              companies.filter(
                (c) => dateKey(c.createdAt).startsWith(month) && c.data.status === statuses[0],
              ).length,
              "تمت إضافتهم هذا الشهر",
              "companies",
              "new",
            )}
            {metric(
              "تم التواصل ولم يتحولوا",
              companies.filter((c) => c.data.status === statuses[0] && c.data.stage !== stages[0])
                .length,
              "عملاء محتملون تم التواصل معهم",
              "companies",
              "contacted",
            )}
            {metric(
              "عملاء حاليون",
              active.length,
              "حسب تصنيف الشركة المسجل",
              "companies",
              statuses[1],
            )}
            {metric(
              "يحتاجون إعادة تنشيط",
              companies.filter((c) => c.data.status === statuses[2]).length,
              "علاقات تستحق الرجوع لها",
              "companies",
              statuses[2],
              "amber",
            )}
            {metric(
              "فرص بيع مفتوحة",
              opportunities.filter((o) => ![stages[6], stages[7]].includes(o.data.stage)).length,
              "غير مغلقة بعد",
              "pipeline",
              "open",
            )}
            {metric("فرص كسبناها", won.length, "مرحلة عميل نشط", "pipeline", "won")}
            {metric("فرص مفقودة", lost.length, "راجع أسباب الخسارة", "pipeline", "lost", "red")}
            {metric(
              "معدل كسب الفرص",
              won.length + lost.length
                ? `${ar(Math.round((won.length / (won.length + lost.length)) * 100))}٪`
                : "—",
              "الفرص الرابحة ÷ الفرص المغلقة",
              "pipeline",
              "closed",
            )}
            {metric(
              "نسبة العملاء الحاليين",
              companies.length
                ? `${ar(Math.round((active.length / companies.length) * 100))}٪`
                : "—",
              "العملاء الحاليون ÷ جميع الشركات (ليست معدل تحويل تاريخي)",
              "companies",
              statuses[1],
            )}
          </div>
        </details>
        <ActionGaps
          visits={visits}
          tasks={tasks}
          companies={companies}
          open={(id) => open("followup", undefined, id)}
        />
      </>
    );
  }
  function profile(c: Row) {
    const hist = rows
      .filter((r) => r.companyId === c.id && r.kind !== "stop")
      .sort((a, b) =>
        (b.kind === "visit" ? b.data.date : b.createdAt).localeCompare(
          a.kind === "visit" ? a.data.date : a.createdAt,
        ),
      );
    const cv = visits
      .filter((v) => v.companyId === c.id)
      .sort((a, b) => b.data.date.localeCompare(a.data.date));
    const ct = tasks
      .filter((t) => t.companyId === c.id && t.data.status !== "done")
      .sort((a, b) => (a.data.due || "9999").localeCompare(b.data.due || "9999"));
    const last = cv[0];
    return (
      <>
        <button className="back-btn" onClick={() => setSelected("")}>
          <ChevronRight size={18} />
          رجوع للشركات
        </button>
        <section className="profile-header panel">
          <div className="company-avatar">{c.data.name.slice(0, 1)}</div>
          <div className="profile-heading">
            <h2>{c.data.name}</h2>
            <p>
              {[c.data.category, c.data.neighborhood, c.data.city].filter(Boolean).join(" · ") ||
                "أكمل بيانات الشركة"}
            </p>
            <div className="meta">
              <Tag tone="teal">{c.data.status}</Tag>
              <Tag>أولوية {c.data.priority}</Tag>
              <Tag>{c.data.stage}</Tag>
            </div>
          </div>
          <div className="header-actions">
            <button
              disabled={!editable(c)}
              className="secondary"
              onClick={() => open("company", c)}
            >
              <Pencil size={17} />
              تعديل
            </button>
            <button className="primary" onClick={() => open("visit", undefined, c.id)}>
              <Plus size={17} />
              سجّل زيارة
            </button>
          </div>
        </section>
        <div className="profile-columns">
          <div>
            <section className="panel">
              <div className="section-heading">
                <h3>بيانات الشركة</h3>
                <a href={mapLink(c)} target="_blank" rel="noreferrer" className="text-btn">
                  <MapPin size={16} />
                  افتح الخريطة
                </a>
              </div>
              <dl className="detail-list">
                {[
                  [
                    "العنوان",
                    [c.data.address, c.data.neighborhood, c.data.city, c.data.governorate]
                      .filter(Boolean)
                      .join("، "),
                  ],
                  ["التليفون", c.data.phone],
                  ["البريد", c.data.email],
                  ["حجم الشركة", c.data.size],
                  ["مصدر العميل", c.data.source],
                  ["حالة العلاقة", c.data.relationship],
                  ["آخر زيارة", last ? fmt(last.data.date, true) : "لا توجد زيارة"],
                  [
                    "المتابعة القادمة",
                    ct[0]
                      ? `${ct[0].data.action} — ${fmt(ct[0].data.due, true)}`
                      : "لا توجد متابعة مفتوحة",
                  ],
                  ["الخدمات المستخدمة", (c.data.usedServices || []).join("، ")],
                  ["الخدمات المطلوبة", (c.data.neededServices || []).join("، ")],
                  ["الموقع الإلكتروني", c.data.website],
                  ["روابط اجتماعية", c.data.social],
                  ["ملاحظات", c.data.notes],
                  ["أُضيفت في", fmt(c.createdAt)],
                  ["آخر تحديث", fmt(c.updatedAt, true)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v || "غير مسجل"}</dd>
                  </div>
                ))}
              </dl>
              <div className="contact-links">
                {c.data.phone && (
                  <a className="secondary" href={`tel:${c.data.phone}`}>
                    <Phone size={16} />
                    اتصال
                  </a>
                )}
                {c.data.whatsapp && (
                  <a
                    className="secondary"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://wa.me/${String(c.data.whatsapp).replace(/\D/g, "").replace(/^0/, "20")}`}
                  >
                    <ExternalLink size={16} />
                    واتساب
                  </a>
                )}
                {c.data.email && (
                  <a className="secondary" href={`mailto:${c.data.email}`}>
                    <Mail size={16} />
                    بريد
                  </a>
                )}
              </div>
            </section>
            <section className="panel section-gap">
              <h3>الأشخاص المسؤولون</h3>
              {(c.data.contacts || []).length ? (
                (c.data.contacts || []).map((p: any, i: number) => (
                  <div className="contact-person" key={i}>
                    <strong>{p.name || "اسم غير مسجل"}</strong>
                    <span>{p.role || "وظيفة غير مسجلة"}</span>
                    {p.phone && <a href={`tel:${p.phone}`}>{p.phone}</a>}
                    {p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}
                  </div>
                ))
              ) : (
                <p className="help">أضف الأشخاص من تعديل الشركة.</p>
              )}
            </section>
          </div>
          <div>
            <section className="insight panel">
              <Tag tone="teal">حقائق من سجلاتك — بدون ذكاء اصطناعي</Tag>
              <h3>قبل المقابلة الجاية</h3>
              {last ? (
                <>
                  <p>
                    <b>آخر نتيجة:</b> {last.data.outcome || "غير مسجلة"}
                  </p>
                  {last.data.needs && (
                    <p>
                      <b>الاحتياج:</b> {last.data.needs}
                    </p>
                  )}
                  {last.data.objections && (
                    <p>
                      <b>الاعتراضات:</b> {last.data.objections}
                    </p>
                  )}
                  {last.data.ourPromise && (
                    <p>
                      <b>وعدك للعميل:</b> {last.data.ourPromise}
                    </p>
                  )}
                  {last.data.clientPromise && (
                    <p>
                      <b>وعد العميل:</b> {last.data.clientPromise}
                    </p>
                  )}
                  {last.data.nextAction && (
                    <p>
                      <b>الخطوة المتفق عليها:</b> {last.data.nextAction}
                    </p>
                  )}
                </>
              ) : (
                <p>سجّل أول زيارة عشان تظهر التفاصيل هنا.</p>
              )}
              {ct[0] && (
                <p>
                  <b>المتابعة المطلوبة:</b> {ct[0].data.action} — {fmt(ct[0].data.due, true)}
                </p>
              )}
            </section>
            <section className="panel section-gap">
              <div className="section-heading">
                <div>
                  <h3>تاريخ العلاقة</h3>
                  <p>الزيارات والتواصل والمتابعات وتغييرات الحالة</p>
                </div>
                <button className="text-btn" onClick={() => open("event", undefined, c.id)}>
                  <Plus size={16} />
                  تواصل
                </button>
              </div>
              <div className="profile-quick">
                <button className="secondary" onClick={() => open("followup", undefined, c.id)}>
                  <CalendarClock size={16} />
                  متابعة
                </button>
                <button className="secondary" onClick={() => open("opportunity", undefined, c.id)}>
                  <GitBranch size={16} />
                  فرصة بيع
                </button>
                <button className="secondary" onClick={() => open("stop", undefined, c.id)}>
                  <MapPin size={16} />
                  خطة زيارة
                </button>
              </div>
              {hist.map((r) => (
                <article className="timeline-item" key={r.id}>
                  <div className={`timeline-dot ${r.kind}`} />
                  <div className="timeline-body">
                    <div className="timeline-heading">
                      <strong>
                        {r.kind === "visit"
                          ? r.data.type
                          : r.kind === "followup"
                            ? "متابعة"
                            : r.kind === "opportunity"
                              ? "فرصة بيع"
                              : r.data.channel || "تحديث السجل"}
                      </strong>
                      <small>{fmt(r.kind === "visit" ? r.data.date : r.createdAt, true)}</small>
                    </div>
                    <p>{r.data.text || r.data.action || r.data.description || r.data.outcome}</p>
                    {r.kind === "visit" && (
                      <>
                        <p className="muted">
                          قابلت: {r.data.contact || "غير مسجل"} {r.data.role && `(${r.data.role})`}
                        </p>
                        {r.data.notes && <p>{r.data.notes}</p>}
                        {r.data.nextAction && (
                          <p className="next-text">الخطوة الجاية: {r.data.nextAction}</p>
                        )}
                      </>
                    )}
                    {r.kind === "followup" && (
                      <Tag tone={stateTone(dueState(r))}>
                        {stateLabels[dueState(r)]} · {fmt(r.data.due, true)}
                      </Tag>
                    )}
                    {r.kind === "opportunity" && <Tag>{r.data.stage}</Tag>}
                    {(!r.data.relatedId || r.data.channel) && tools(r)}
                    {r.data.relatedId && rows.find((x) => x.id === r.data.relatedId) && (
                      <button
                        className="text-btn"
                        onClick={() => {
                          const rel = rows.find((x) => x.id === r.data.relatedId);
                          if (rel) open(rel.kind, rel);
                        }}
                      >
                        فتح السجل <ArrowLeft size={14} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {!hist.length && (
                <Empty
                  title="العلاقة لسه بتبدأ"
                  text="أضف زيارة أو ملاحظة عشان تبني تاريخ واضح للشركة."
                />
              )}
            </section>
          </div>
        </div>
      </>
    );
  }
  function companyPage() {
    if (current) return profile(current);
    let list = companies
      .filter(queryMatch)
      .filter((c) => !area || [c.data.city, c.data.neighborhood, c.data.governorate].includes(area))
      .filter((c) => !priority || c.data.priority === priority)
      .filter(
        (c) =>
          filter === "all" ||
          (filter === "new" &&
            dateKey(c.createdAt).startsWith(today().slice(0, 7)) &&
            c.data.status === statuses[0]) ||
          (filter === "contacted" && c.data.status === statuses[0] && c.data.stage !== stages[0]) ||
          c.data.status === filter,
      );
    list.sort((a, b) =>
      sort === "name"
        ? a.data.name.localeCompare(b.data.name, "ar")
        : b.createdAt.localeCompare(a.createdAt),
    );
    return (
      <>
        <div className="filter-tabs">
          {["all", ...statuses].map((s) => (
            <button className={filter === s ? "active" : ""} key={s} onClick={() => setFilter(s)}>
              {s === "all" ? "كل الشركات" : s}
              <span>{ar(companies.filter((c) => s === "all" || c.data.status === s).length)}</span>
            </button>
          ))}
          {["new", "contacted"].includes(filter) && (
            <Tag tone="teal">
              {filter === "new" ? "المضافون هذا الشهر" : "تم التواصل ولم يتحولوا"}
            </Tag>
          )}
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="بحث السجلات"
              placeholder="دوّر بالاسم، التليفون أو الشخص المسؤول…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select aria-label="فلتر المنطقة" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">كل المناطق</option>
            {Array.from(
              new Set(
                companies
                  .flatMap((c) => [c.data.city, c.data.neighborhood, c.data.governorate])
                  .filter(Boolean),
              ),
            )
              .sort()
              .map((a) => (
                <option key={a}>{a}</option>
              ))}
          </select>
          <select
            aria-label="فلتر الأولوية"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">كل الأولويات</option>
            {["A", "B", "C"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select aria-label="ترتيب الشركات" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">الأحدث أولًا</option>
            <option value="name">حسب الاسم</option>
          </select>
        </div>
        <section className="panel table-panel">
          <div className="section-heading">
            <h3>{ar(list.length)} شركة</h3>
            <button
              className="text-btn"
              onClick={() =>
                download(
                  "midway-companies.csv",
                  csv(
                    list.map((c) => ({
                      ...c.data,
                      createdAt: c.createdAt,
                      updatedAt: c.updatedAt,
                    })),
                  ),
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Download size={16} />
              تصدير القائمة
            </button>
          </div>
          {list.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>الشركة</th>
                    <th>المنطقة</th>
                    <th>تصنيف العميل</th>
                    <th>الأولوية</th>
                    <th>آخر زيارة</th>
                    <th>المتابعة القادمة</th>
                    <th aria-label="إجراءات" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const v = visits
                      .filter((v) => v.companyId === c.id)
                      .sort((a, b) => b.data.date.localeCompare(a.data.date))[0];
                    const t = tasks
                      .filter((t) => t.companyId === c.id && t.data.status !== "done")
                      .sort((a, b) =>
                        (a.data.due || "9999").localeCompare(b.data.due || "9999"),
                      )[0];
                    return (
                      <tr key={c.id}>
                        <td aria-label="الشركة">
                          <div className="table-company">
                            <div className="company-avatar small">{c.data.name[0]}</div>
                            <div>
                              {companyButton(c.id)}
                              <small>
                                {c.data.category || c.data.phone || "بيانات إضافية غير مسجلة"}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {[c.data.neighborhood, c.data.city].filter(Boolean).join("، ") || "—"}
                        </td>
                        <td>
                          <Tag tone={c.data.status === statuses[1] ? "teal" : "neutral"}>
                            {c.data.status}
                          </Tag>
                        </td>
                        <td>
                          <Tag>{c.data.priority || "B"}</Tag>
                        </td>
                        <td>{v ? fmt(v.data.date) : "لم تتم زيارة"}</td>
                        <td>
                          {t ? <Tag tone={stateTone(dueState(t))}>{fmt(t.data.due)}</Tag> : "—"}
                        </td>
                        <td>{tools(c)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title={companies.length ? "مفيش نتائج مطابقة" : "ابدأ بأول شركة"}
              text={
                companies.length
                  ? "جرّب تغيير البحث أو الفلاتر."
                  : "أضف اسم الشركة وبيانات التواصل، وكمل التفاصيل بعدين."
              }
              action="إضافة شركة"
              onClick={() => open("company")}
            />
          )}
        </section>
      </>
    );
  }
  function visitPage() {
    const d = new Date(today() + "T12:00:00");
    d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
    const week = d.toISOString().slice(0, 10);
    let list = visits
      .filter(queryMatch)
      .filter(
        (v) =>
          filter === "all" ||
          (filter === "linked" && linkedVisits(visits, opportunities).some((x) => x.id === v.id)) ||
          (filter === "today" && dateKey(v.data.date) === today()) ||
          (filter === "week" && dateKey(v.data.date) >= week && dateKey(v.data.date) <= today()) ||
          (filter === "month" &&
            dateKey(v.data.date).startsWith(today().slice(0, 7)) &&
            dateKey(v.data.date) <= today()) ||
          v.data.type === filter,
      )
      .sort((a, b) => b.data.date.localeCompare(a.data.date));
    return (
      <>
        <div className="toolbar">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="بحث السجلات"
              placeholder="دوّر في الزيارات والتفاصيل…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="فلتر الزيارات"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">كل الزيارات</option>
            <option value="linked">زيارات مرتبطة بفرص</option>
            <option value="today">النهارده</option>
            <option value="week">الأسبوع الحالي</option>
            <option value="month">الشهر الحالي</option>
            {visitTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <Tag>{ar(list.length)} زيارة</Tag>
        </div>
        <div className="record-grid">
          {list.map((v) => (
            <section className="panel visit-card" key={v.id}>
              <div className="section-heading">
                <Tag tone="teal">{v.data.type}</Tag>
                {tools(v)}
              </div>
              {companyButton(v.companyId)}
              <p className="meta">
                <CalendarDays size={15} />
                {fmt(v.data.date, true)}
              </p>
              <dl className="visit-details">
                <div>
                  <dt>قابلت</dt>
                  <dd>
                    {v.data.contact || "غير مسجل"} {v.data.role && `· ${v.data.role}`}
                  </dd>
                </div>
                <div>
                  <dt>النتيجة</dt>
                  <dd>{v.data.outcome || "غير مسجلة"}</dd>
                </div>
                <div>
                  <dt>الاهتمام</dt>
                  <dd>{v.data.interest || "غير معروف"}</dd>
                </div>
              </dl>
              {v.data.notes && <p className="note-text">{v.data.notes}</p>}
              {v.data.nextAction ? (
                <div className="next-action">
                  <ArrowLeft size={16} />
                  <div>
                    <strong>{v.data.nextAction}</strong>
                    <small>{fmt(v.data.nextDue, true)}</small>
                  </div>
                </div>
              ) : (
                <div className="muted small-text">لم تُحدد خطوة جاية لهذه الزيارة</div>
              )}
              <button className="text-btn" onClick={() => open("visit", v)}>
                عرض التفاصيل وتعديلها <ArrowLeft size={15} />
              </button>
            </section>
          ))}
        </div>
        {!list.length && (
          <section className="panel">
            <Empty
              title="مفيش زيارات في العرض ده"
              text="سجّل الزيارة فور انتهاء المقابلة، والتفاصيل هتفضل محفوظة."
              action="تسجيل زيارة"
              onClick={() => open("visit")}
            />
          </section>
        )}
      </>
    );
  }
  function followupPage() {
    const list = tasks
      .filter(queryMatch)
      .filter((t) => filter === "all" || dueState(t) === filter)
      .sort(
        (a, b) =>
          (a.data.status === "done" ? 1 : 0) - (b.data.status === "done" ? 1 : 0) ||
          (a.data.due || "9999").localeCompare(b.data.due || "9999"),
      );
    return (
      <>
        <div className="reminder-note">
          <AlertCircle size={18} />
          <span>
            التذكيرات هنا داخل التطبيق، وتتحدث كل دقيقة أثناء فتحه. لا توجد إشعارات خلفية أو تنبيهات
            عند إغلاقه.
          </span>
        </div>
        <div className="filter-tabs">
          {["all", "today", "overdue", "upcoming", "done", "unscheduled"].map((s) => (
            <button key={s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>
              {s === "all" ? "الكل" : stateLabels[s]}
              <span>{ar(tasks.filter((t) => s === "all" || dueState(t) === s).length)}</span>
            </button>
          ))}
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="بحث السجلات"
              placeholder="دوّر بالشركة أو الخطوة المطلوبة…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Tag>{ar(list.length)} متابعة</Tag>
        </div>
        <section className="panel">
          {list.map(taskCard)}
          {!list.length && (
            <Empty
              title="مفيش متابعات في العرض ده"
              text="أضف متابعة بمهمة واضحة، أو غيّر الفلتر لعرض بقية السجلات."
              action="إضافة متابعة"
              onClick={() => open("followup")}
            />
          )}
        </section>
        <p className="help">
          لإعادة الجدولة أو تسجيل ملاحظات الإتمام: اضغط علامة القلم. بعد الإتمام، علامة + تضيف متابعة
          تالية لنفس الشركة.
        </p>
        <CalendarExport tasks={tasks} companies={companies} />
      </>
    );
  }
  function pipelinePage() {
    const show = (o: Row) =>
      filter === "all" ||
      (filter === "open" && ![stages[6], stages[7]].includes(o.data.stage)) ||
      (filter === "won" && o.data.stage === stages[6]) ||
      (filter === "lost" && o.data.stage === stages[7]) ||
      (filter === "closed" && [stages[6], stages[7]].includes(o.data.stage));
    return (
      <>
        <div className="toolbar">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="بحث السجلات"
              placeholder="دوّر في الشركات والفرص…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="فلتر الفرص"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              ["all", "كل الفرص"],
              ["open", "مفتوحة"],
              ["won", "رابحة"],
              ["lost", "مفقودة"],
              ["closed", "مغلقة"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="pipeline-scroll">
          {stages.map((stage, i) => {
            const os = opportunities.filter(
              (o) => o.data.stage === stage && show(o) && queryMatch(o),
            );
            const cs = companies.filter((c) => c.data.stage === stage && queryMatch(c));
            return (
              <section className="pipeline-column" key={stage}>
                <header>
                  <span className={`stage-dot stage-${i}`} />
                  <h3>{stage}</h3>
                  <Tag>{ar(os.length)}</Tag>
                </header>
                <small className="column-sub">
                  {ar(cs.length)} شركة · {ar(os.length)} فرصة
                </small>
                {os.map((o) => (
                  <article className="opportunity-card" key={o.id}>
                    {companyButton(o.companyId)}
                    <h4>{o.data.description}</h4>
                    <Tag>{o.data.service}</Tag>
                    {o.data.value && (
                      <strong className="opportunity-value">
                        {Number(o.data.value).toLocaleString("ar-EG")} <small>ج.م. تقديرية</small>
                      </strong>
                    )}
                    {o.data.probability && (
                      <p className="small-text muted">احتمال مقدّر: {o.data.probability}%</p>
                    )}
                    {o.data.nextAction && <p>{o.data.nextAction}</p>}
                    {o.data.reason && <p className="small-text">النتيجة: {o.data.reason}</p>}
                    <select
                      aria-label={`مرحلة ${o.data.description}`}
                      value={o.data.stage}
                      disabled={busy}
                      onChange={(e) => update(o, { stage: e.target.value })}
                    >
                      {stages.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    {tools(o)}
                  </article>
                ))}
                {cs.map((c) => (
                  <article className="pipeline-company" key={c.id}>
                    {companyButton(c.id)}
                    <small>مرحلة الشركة</small>
                    <select
                      aria-label={`مرحلة شركة ${c.data.name}`}
                      value={c.data.stage}
                      disabled={busy}
                      onChange={(e) => update(c, { stage: e.target.value })}
                    >
                      {stages.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </article>
                ))}
                {!os.length && !cs.length && <p className="pipeline-empty">لا توجد سجلات هنا</p>}
              </section>
            );
          })}
        </div>
        <p className="help">
          نقل شركة أو فرصة بين المراحل لا يغيّر تصنيف الشركة تلقائيًا. «عميل حالي» يتطلب تعديلًا صريحًا في
          ملف الشركة.
        </p>
      </>
    );
  }
  async function importFile(file: File, backup = false) {
    setError("");
    setImportBusy(true);
    try {
      const text = await file.text();
      if (backup) {
        const obj = JSON.parse(text);
        if (obj.version !== 1 || !Array.isArray(obj.rows)) throw Error("نسخة احتياطية غير صالحة");
        const res = await client.crm.restore({ rows: obj.rows });
        setToast(`تمت استعادة ${res.count} سجل`);
      } else {
        const data = parseCSV(text);
        if (data.length > 500) throw Error("الحد الأقصى ٥٠٠ شركة في المرة");
        let count = 0,
          dupes = 0;
        for (const r of data) {
          const name = r.name || r["اسم الشركة"];
          if (!name) continue;
          try {
            let contacts = [];
            try {
              contacts = JSON.parse(r.contacts || "[]");
            } catch {}
            const d = {
              ...defaults("company"),
              ...r,
              name,
              phone: r.phone || r["التليفون"] || "",
              city: r.city || r["المدينة"] || "",
              contacts,
              usedServices: r.usedServices ? r.usedServices.split(" | ") : [],
              neededServices: r.neededServices ? r.neededServices.split(" | ") : [],
            };
            if (!statuses.includes(d.status || "")) d.status = statuses[0];
            if (!stages.includes(d.stage || "")) d.stage = stages[0];
            await client.crm.save({ kind: "company", data: d });
            count++;
          } catch (e: any) {
            if (e.code === "CONFLICT") {
              dupes++;
              continue;
            }
            throw Error(`تم حفظ ${count} شركة قبل الخطأ: ${e.message}`);
          }
        }
        if (!count && !dupes) throw Error("لم أجد عمود name أو اسم الشركة");
        setToast(`تم استيراد ${count} شركة، وتخطي ${dupes} مكررة.`);
      }
      await q.invalidateQueries();
    } catch (e: any) {
      setError(e.message || "تعذر الاستيراد");
      await q.invalidateQueries();
    } finally {
      setImportBusy(false);
    }
  }
  function reportsPage() {
    const range = (v: string) => {
      const d = dateKey(v);
      return d >= from && d <= to;
    };
    const vr = visits.filter(
      (v) =>
        range(v.data.date) &&
        (!reportCompany || v.companyId === reportCompany) &&
        (!reportArea ||
          [company(v.companyId)?.data.city, company(v.companyId)?.data.neighborhood].includes(
            reportArea,
          )),
    );
    const tr = tasks.filter(
      (t) =>
        range(
          t.data.status === "done" ? t.data.completedAt || t.updatedAt : t.data.due || t.createdAt,
        ) &&
        (!reportCompany || t.companyId === reportCompany) &&
        (!reportArea ||
          [company(t.companyId)?.data.city, company(t.companyId)?.data.neighborhood].includes(
            reportArea,
          )),
    );
    const or = opportunities.filter(
      (o) =>
        range(o.updatedAt) &&
        (!reportCompany || o.companyId === reportCompany) &&
        (!reportArea ||
          [company(o.companyId)?.data.city, company(o.companyId)?.data.neighborhood].includes(
            reportArea,
          )),
    );
    const old = companies.filter((c) => {
      const contacts = rows.filter(
        (r) =>
          r.companyId === c.id &&
          (r.kind === "visit" ||
            (r.kind === "event" && r.data.channel) ||
            (r.kind === "followup" && r.data.status === "done")),
      );
      const latest = contacts
        .map((r) =>
          r.kind === "visit"
            ? r.data.date
            : r.kind === "followup"
              ? r.data.completedAt || r.updatedAt
              : r.createdAt,
        )
        .sort()
        .pop();
      return !latest || Date.now() - Date.parse(latest) > 30 * 86400000;
    });
    const conversions = rows.filter(
      (r) =>
        r.kind === "event" &&
        r.data.statusTo === statuses[1] &&
        r.data.statusFrom !== statuses[1] &&
        range(r.createdAt) &&
        (!reportCompany || r.companyId === reportCompany) &&
        (!reportArea ||
          [company(r.companyId)?.data.city, company(r.companyId)?.data.neighborhood].includes(
            reportArea,
          )),
    );
    const conversionCompanies = new Set(conversions.map((r) => r.companyId));
    const breakdown = (title: string, opts: string[], rs: Row[], key: string) => (
      <section className="panel">
        <h3>{title}</h3>
        <div className="report-bars">
          {opts.map((o) => {
            const n = rs.filter((r) => r.data[key] === o).length;
            return (
              <div className="bar-row" key={o}>
                <span>{o}</span>
                <div className="bar-track">
                  <i style={{ width: `${rs.length ? (n / rs.length) * 100 : 0}%` }} />
                </div>
                <b>{ar(n)}</b>
              </div>
            );
          })}
        </div>
      </section>
    );
    return (
      <>
        <div className="toolbar report-toolbar">
          <label className="inline-label">
            من
            <input
              aria-label="بداية فترة التقرير"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="inline-label">
            إلى
            <input
              aria-label="نهاية فترة التقرير"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <select
            aria-label="شركة التقرير"
            value={reportCompany}
            onChange={(e) => setReportCompany(e.target.value)}
          >
            <option value="">كل الشركات</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.data.name}
              </option>
            ))}
          </select>
          <select
            aria-label="منطقة التقرير"
            value={reportArea}
            onChange={(e) => setReportArea(e.target.value)}
          >
            <option value="">كل مناطق الزيارات</option>
            {Array.from(
              new Set(companies.flatMap((c) => [c.data.city, c.data.neighborhood]).filter(Boolean)),
            ).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <button
            className="secondary"
            onClick={() =>
              download(
                "midway-visits-report.csv",
                csv(
                  vr.map((v) => ({
                    company: cname(v.companyId),
                    area: company(v.companyId)?.data.neighborhood || "",
                    ...v.data,
                  })),
                ),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={17} />
            تصدير الزيارات
          </button>
        </div>
        <div className="metrics-grid">
          {metric("زيارات الفترة", vr.length, "حسب التاريخ والشركة والمنطقة", "visits", "all")}
          {metric(
            "متابعات مكتملة",
            tr.filter((t) => t.data.status === "done").length,
            "تاريخ الإتمام خلال الفترة",
            "followups",
            "done",
          )}
          {metric(
            "متابعات متأخرة",
            tr.filter((t) => dueState(t) === "overdue").length,
            "موعدها في الفترة المحددة",
            "followups",
            "overdue",
            "red",
          )}
          {metric(
            "شركات سُجل تحويلها",
            conversionCompanies.size,
            "تغيير التصنيف إلى عميل حالي خلال الفترة",
            "companies",
            statuses[1],
          )}
        </div>
        <PerformanceInsights
          rows={rows}
          from={from}
          to={to}
          companyId={reportCompany}
          area={reportArea}
          open={open}
        />
        <div className="report-grid">
          {breakdown("أول زيارة مقابل المتابعات", visitTypes, vr, "type")}
          {breakdown("نتائج الزيارات", outcomes, vr, "outcome")}
          {breakdown("الخدمات وفرص البيع", services, or, "service")}
          <section className="panel">
            <h3>الفرص المفقودة وأسبابها</h3>
            {or
              .filter((o) => o.data.stage === stages[7])
              .map((o) => (
                <div className="report-item" key={o.id}>
                  {companyButton(o.companyId)}
                  <p>{o.data.description}</p>
                  <small>{o.data.reason || "سبب الخسارة غير مسجل"}</small>
                </div>
              ))}
            {!or.some((o) => o.data.stage === stages[7]) && (
              <p className="help">لا توجد فرص مفقودة تم تحديثها في الفترة المحددة.</p>
            )}
          </section>
        </div>
        <section className="panel section-gap">
          <div className="section-heading">
            <div>
              <h3>شركات تحتاج تواصل جديد</h3>
              <p>بدون زيارة أو تواصل مسجل خلال آخر ٣٠ يومًا، بصرف النظر عن الفترة أعلاه.</p>
            </div>
            <Tag>{ar(old.length)}</Tag>
          </div>
          <div className="stale-companies">
            {old.map((c) => (
              <div key={c.id}>
                {companyButton(c.id)}
                <button className="text-btn" onClick={() => open("followup", undefined, c.id)}>
                  أضف متابعة <Plus size={14} />
                </button>
              </div>
            ))}
          </div>
          {!old.length && <p className="help">لا توجد شركات منقطعة عن التواصل حسب السجلات.</p>}
        </section>
        <section className="panel portability section-gap">
          <div className="section-heading">
            <div>
              <h3>بياناتك تحت إيدك</h3>
              <p>نسخة JSON كاملة للحفاظ على العلاقات، وCSV يفتح في Excel.</p>
            </div>
            <ShieldCheck size={23} />
          </div>
          <div className="portability-grid">
            <div>
              <h4>نسخة احتياطية كاملة</h4>
              <p>تضم الشركات والأشخاص والزيارات والمتابعات والفرص وخطة اليوم وتاريخ العلاقة.</p>
              <button
                className="secondary"
                onClick={() =>
                  download(
                    `midway-backup-${today()}.json`,
                    JSON.stringify(
                      {
                        version: 1,
                        exportedAt: new Date().toISOString(),
                        rows: rows.map(({ id, kind, companyId, data, createdAt, updatedAt }) => ({
                          id,
                          kind,
                          companyId,
                          data,
                          createdAt,
                          updatedAt,
                        })),
                      },
                      null,
                      2,
                    ),
                    "application/json",
                  )
                }
              >
                <Download size={17} />
                تنزيل النسخة
              </button>
              <label className={`secondary file-btn ${importBusy ? "disabled" : ""}`}>
                <Upload size={17} />
                استعادة نسخة JSON
                <input
                  aria-label="اختيار ملف للاستيراد"
                  type="file"
                  accept=".json"
                  disabled={importBusy || rows.length > 0}
                  onChange={(e) => {
                    if (e.target.files?.[0]) importFile(e.target.files[0], true);
                    e.target.value = "";
                  }}
                />
              </label>
              <small>الاستعادة لحساب فارغ فقط؛ لا تستبدل بيانات موجودة.</small>
            </div>
            <div>
              <h4>استيراد الشركات</h4>
              <p>احفظ ورقة Excel بصيغة CSV UTF-8. التكرارات تُتخطى بدون استبدال سجلاتك.</p>
              <button
                className="text-btn"
                onClick={() =>
                  download(
                    "midway-import-template.csv",
                    csv([
                      {
                        name: "",
                        phone: "",
                        whatsapp: "",
                        email: "",
                        city: "",
                        governorate: "",
                        neighborhood: "",
                        address: "",
                        status: statuses[0],
                        priority: "B",
                        notes: "",
                      },
                    ]),
                    "text/csv;charset=utf-8",
                  )
                }
              >
                <Download size={16} />
                تحميل نموذج الأعمدة
              </button>
              <label className={`secondary file-btn ${importBusy ? "disabled" : ""}`}>
                <Upload size={17} />
                {importBusy ? "جاري الاستيراد…" : "استيراد ملف CSV"}
                <input
                  aria-label="اختيار ملف للاستيراد"
                  type="file"
                  accept=".csv"
                  disabled={importBusy}
                  onChange={(e) => {
                    if (e.target.files?.[0]) importFile(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <small>حتى ٥٠٠ شركة في كل ملف؛ التصدير الكامل حتى ٥٠٠٠ سجل للاستعادة.</small>
            </div>
            <div>
              <h4>تصدير سجلاتك</h4>
              <p>ملفات مستقلة للمراجعة والتحليل خارج التطبيق.</p>
              {["company", "visit", "followup", "opportunity", "stop"].map((k, i) => (
                <button
                  className="text-btn export-link"
                  key={k}
                  onClick={() =>
                    download(
                      `midway-${k}.csv`,
                      csv(
                        rows
                          .filter((r) => r.kind === k)
                          .map((r) => ({
                            id: r.id,
                            company: k === "company" ? r.data.name : cname(r.companyId),
                            ...r.data,
                            createdAt: r.createdAt,
                            updatedAt: r.updatedAt,
                          })),
                      ),
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  <Download size={15} />
                  {["الشركات", "الزيارات", "المتابعات", "الفرص", "خطة الزيارات"][i]}
                </button>
              ))}
            </div>
          </div>
        </section>
        <div className="reminder-note section-gap">
          <FileText size={18} />
          <span>
            لا يوجد تسجيل صوتي أو تحليل AI أو رفع مرفقات في هذه النسخة. التقارير تعتمد على البيانات
            المسجلة فقط. الأرقام المالية تقديراتك وليست حجوزات أو مبيعات محاسبية.
          </span>
        </div>
      </>
    );
  }
  const topAction =
    page === "companies"
      ? "company"
      : page === "visits"
        ? "visit"
        : page === "followups"
          ? "followup"
          : page === "pipeline"
            ? "opportunity"
            : page === "plan"
              ? "stop"
              : "company";
  const actionLabel: Record<string, string> = {
    company: "إضافة شركة",
    visit: "تسجيل زيارة",
    followup: "إضافة متابعة",
    opportunity: "إضافة فرصة",
    stop: "إضافة محطة",
  };
  return (
    <div className="workspace" dir="rtl">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="brand">
          <div className="sales-brand" dir="ltr">
            eslam b2b
            <br />
            Sales attract
          </div>
          <small>مساحة عمل المبيعات الميدانية</small>
        </div>
        <div className="nav-label">مساحة العمل</div>
        <div className="workspace-links">
          <Link href="/">العمليات ولوحة الفرع</Link>
          <Link href="/account">حسابي</Link>
        </div>
        <nav>
          {nav.map((n) => (
            <button key={n.id} className={page === n.id ? "active" : ""} onClick={() => go(n.id)}>
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "followups" && overdue.length > 0 && (
                <b className="nav-badge">{ar(overdue.length)}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <ShieldCheck size={19} />
            <div>
              <strong>شغلك محفوظ</strong>
              <small>بيانات الفرع حسب صلاحيات حسابك</small>
            </div>
          </div>
          <div className="user-box">
            <span className="user-avatar">{session?.user.name?.[0] || "م"}</span>
            <div>
              <strong>{session?.user.name}</strong>
              <small>العملاء والمتابعات · مصر</small>
            </div>
            <button
              className="icon-btn"
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
              onClick={async () => {
                await authClient.signOut();
                q.clear();
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="فتح القائمة"
            >
              <Menu size={22} />
            </button>
            <span>مساحة العمل</span>
            <ChevronLeft size={14} />
            <b>{nav.find((n) => n.id === page)?.label}</b>
          </div>
          <div className="topbar-right">
            <strong className="app-title" dir="ltr">
              eslam b2b Sales attract
            </strong>
            <span className="date-pill">
              <CalendarDays size={16} />
              {new Intl.DateTimeFormat("ar-EG", {
                dateStyle: "full",
                timeZone: "Africa/Cairo",
              }).format(new Date())}
            </span>
            <button
              className="reminder-button"
              onClick={() => go("followups", "overdue")}
              title="المتابعات المتأخرة"
            >
              <CalendarClock size={20} />
              {overdue.length > 0 && <i />}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">MIDWAY · FIELD SALES</div>
              <h1>{selected && current ? current.data.name : titles[page]}</h1>
              <p>{subtitles[page]}</p>
            </div>
            {page !== "reports" && (
              <button className="primary" onClick={() => open(topAction, undefined, selected)}>
                <Plus size={19} />
                {actionLabel[topAction]}
              </button>
            )}
          </div>
          {error && (
            <div className="error global-error">
              {error}
              <button className="icon-btn" aria-label="إغلاق الخطأ" onClick={() => setError("")}>
                <X size={18} />
              </button>
            </div>
          )}
          {query.isLoading ? (
            <div className="loading-state">
              <RefreshCw className="spin" size={28} />
              <h3>جاري تحميل مساحة عملك…</h3>
            </div>
          ) : query.isError ? (
            <section className="panel">
              <Empty
                title="تعذر تحميل البيانات"
                text="راجع الاتصال بالإنترنت. بياناتك لم تُحذف."
                action="إعادة المحاولة"
                onClick={() => query.refetch()}
              />
            </section>
          ) : page === "dashboard" ? (
            dashboard()
          ) : page === "companies" ? (
            companyPage()
          ) : page === "visits" ? (
            visitPage()
          ) : page === "followups" ? (
            followupPage()
          ) : page === "pipeline" ? (
            pipelinePage()
          ) : page === "plan" ? (
            <>
              <GeoPlanner rows={rows} open={open} date={planDate} onDate={setPlanDate} />
              <h3 className="section-gap">المحطات المحفوظة</h3>
              <DailyPlan
                {...{
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
                }}
              />
            </>
          ) : (
            <>
              <div className="filter-tabs analytics-tabs">
                {[
                  ["performance", "الأداء والتوصيات"],
                  ["pipeline", "مسار البيع والفرص"],
                  ["data", "البيانات والنسخ الاحتياطي"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={analyticsTab === id ? "active" : ""}
                    onClick={() => setAnalyticsTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {analyticsTab === "pipeline" ? (
                pipelinePage()
              ) : (
                <div
                  className={`analytics-content ${analyticsTab === "data" ? "data-tab" : "performance-tab"}`}
                >
                  {reportsPage()}
                </div>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>Midway for Tourism · إدارة المبيعات الميدانية</span>
            <span>
              التوقيت: القاهرة · {query.isFetching ? "جاري المزامنة…" : "الحفظ سحابي، يحتاج إنترنت"}
            </span>
          </footer>
        </main>
      </div>
      {form && (
        <RecordForm
          key={`${form.kind}-${form.row?.id || "new"}`}
          {...form}
          rows={rows}
          close={() => {
            setForm(null);
          }}
        />
      )}
      {confirm && (
        <div className="modal-backdrop">
          <dialog open className="confirm-modal" aria-modal="true">
            <div className="danger-icon">
              <Trash2 size={26} />
            </div>
            <h2>حذف السجل؟</h2>
            <p>
              {confirm.kind === "company"
                ? `سيتم حذف «${confirm.data.name}» وكل زياراتها ومتابعاتها وفرصها وخطة زياراتها. لا يمكن التراجع.`
                : "سيتم حذف هذا السجل نهائيًا. لا يمكن التراجع."}
            </p>
            <div className="confirm-actions">
              <button className="danger-btn" disabled={remove.isPending} onClick={del}>
                {remove.isPending ? "جاري الحذف…" : "نعم، احذف"}
              </button>
              <button
                className="secondary"
                disabled={remove.isPending}
                onClick={() => setConfirm(null)}
              >
                إلغاء
              </button>
            </div>
          </dialog>
        </div>
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
    </div>
  );
}
