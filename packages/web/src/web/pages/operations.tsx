import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Plane,
  Building2,
  UsersRound,
  ChartNoAxesCombined,
  Plus,
  ChevronDown,
  ChevronLeft,
  ArrowUpLeft,
  Search,
  CalendarDays,
  Download,
  SlidersHorizontal,
  Clock3,
  CheckCheck,
  CircleX,
  Paperclip,
  Eye,
  Menu,
  X,
  Info,
  ShieldCheck,
  Activity,
  ArrowRight,
  RefreshCw,
  BriefcaseBusiness,
  ChevronRight,
  Check,
  FileText,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  type OperationsData,
  type RequestRecord,
  type Attachment,
  type Company,
  type Filters,
  type Status,
  emptyFilters,
  loadData,
  saveData,
  filterRequests,
  metrics,
  isPending,
  isIssued,
  statuses,
  statusNames,
  services,
  serviceNames,
  finances,
  num,
  date,
  exportCsv,
} from "../lib/operations";
import { Panel, VolumeChart, ServicesChart, EmployeeChart } from "../components/operations-charts";
import {
  Modal,
  RequestForm,
  RequestDetail,
  CompanyForm,
  StatusBadge,
} from "../components/operations-dialogs";
const navItems = [
  { id: "dashboard", path: "/", label: "لوحة العمليات", icon: LayoutDashboard },
  { id: "requests", path: "/requests", label: "الطلبات والحجوزات", icon: Plane },
  { id: "companies", path: "/companies", label: "شركات العملاء", icon: Building2 },
  { id: "employees", path: "/employees", label: "فريق الحجوزات", icon: UsersRound },
  { id: "reports", path: "/reports", label: "التقارير والأداء", icon: ChartNoAxesCombined },
];
function RequestsTable({
  rows,
  data,
  onView,
  compact = false,
}: {
  rows: RequestRecord[];
  data: OperationsData;
  onView: (r: RequestRecord) => void;
  compact?: boolean;
}) {
  const [page, setPage] = useState(0);
  const size = 10;
  useEffect(() => setPage(0), [rows]);
  const display = compact ? rows.slice(0, 5) : rows.slice(page * size, (page + 1) * size);
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>مرجع الطلب</th>
              <th>شركة العميل</th>
              <th>الموظف</th>
              <th>الخدمة / المسار</th>
              {!compact && <th>شركة الطيران</th>}
              <th>الحالة</th>
              <th>القيمة</th>
              <th className="center">المرفقات</th>
              <th aria-label="الإجراءات" />
            </tr>
          </thead>
          <tbody>
            {display.map((r) => {
              const c = data.companies.find((c) => c.id === r.companyId);
              const e = data.employees.find((e) => e.id === r.employeeId);
              return (
                <tr key={r.id}>
                  <td>
                    <button className="reference" dir="ltr" onClick={() => onView(r)}>
                      {r.ref}
                    </button>
                    <small>{date(r.createdAt)}</small>
                  </td>
                  <td>
                    <span className="company-name">{c?.name ?? "شركة غير متاحة"}</span>
                  </td>
                  <td aria-label={e?.name ?? "موظف"}>
                    <div className="person-cell">
                      <span className={`avatar small ${e?.color}`}>{e?.initials}</span>
                      <span>{e?.name}</span>
                    </div>
                  </td>
                  <td>
                    <span>{serviceNames[r.service]}</span>
                    {r.origin && r.destination && (
                      <small className="route" dir="ltr">
                        {r.origin} <Plane size={10} /> {r.destination}
                      </small>
                    )}
                  </td>
                  {!compact && <td className="latin">{r.airline || "—"}</td>}
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    <span className="amount numeric">
                      {r.amount === null ? "—" : num(r.amount)}
                    </span>
                    {r.amount !== null && <small className="latin">{r.currency}</small>}
                  </td>
                  <td className="center">
                    {r.attachmentIds.length ? (
                      <span className="attachment-count">
                        <Paperclip size={14} />
                        {r.attachmentIds.length}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      onClick={() => onView(r)}
                      aria-label={`عرض ${r.ref}`}
                    >
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="empty">
          <Search size={30} />
          <h4>لا توجد طلبات مطابقة</h4>
          <p>غيّر الفترة أو عوامل التصفية، أو سجّل أول طلب.</p>
        </div>
      )}
      {!compact && rows.length > 0 && (
        <div className="pagination">
          <span>
            عرض {page * size + 1}–{Math.min((page + 1) * size, rows.length)} من {num(rows.length)}{" "}
            طلب
          </span>
          <div>
            <button
              className="icon-button"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              aria-label="الصفحة السابقة"
            >
              <ChevronRight size={17} />
            </button>
            <span>
              {page + 1} / {Math.ceil(rows.length / size)}
            </span>
            <button
              className="icon-button"
              disabled={(page + 1) * size >= rows.length}
              onClick={() => setPage(page + 1)}
              aria-label="الصفحة التالية"
            >
              <ChevronLeft size={17} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
function FinancialPanel({ rows }: { rows: RequestRecord[] }) {
  const totals = finances(rows);
  return (
    <Panel title="الملخص المالي المسجل" subtitle="الطلبات المكتملة فقط • العملات لا تُجمع معًا">
      {totals.length ? (
        <div className="financial-grid">
          {totals.map((f) => (
            <div key={f.currency}>
              <span className="currency-label">{f.currency}</span>
              <div>
                <small>قيمة الخدمات المسجلة</small>
                <strong className="numeric">{num(f.amount)}</strong>
                <span>{f.recorded} طلب بقيمة مسجلة</span>
              </div>
              <div>
                <small>العمولات / الإيراد</small>
                <strong className="numeric green-text">{num(f.commission)}</strong>
                <span>{f.commissionRecorded} طلب بعمولة مسجلة</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">لا توجد بيانات مالية مسجلة للطلبات المكتملة.</div>
      )}
      <p className="panel-footnote">
        لا تشمل القيم المفقودة أو الإلغاء أو الاسترداد. هذا ملخص تشغيلي وليس تقريرًا محاسبيًا.
      </p>
    </Panel>
  );
}
export default function Operations() {
  const [location, navigate] = useLocation();
  const current = navItems.find((n) => n.path === location)?.id ?? "dashboard";
  const [data, setData] = useState<OperationsData>();
  const [loadError, setLoadError] = useState("");
  const [role, setRole] = useState("manager");
  const [employeeId, setEmployeeId] = useState("e1");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [newRequest, setNewRequest] = useState(false);
  const [detailId, setDetailId] = useState("");
  const [editId, setEditId] = useState("");
  const [companyModal, setCompanyModal] = useState<Company | "new" | null>(null);
  const [companyDetail, setCompanyDetail] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [info, setInfo] = useState(false);
  const [toast, setToast] = useState("");
  const boot = () => {
    setLoadError("");
    loadData()
      .then(setData)
      .catch(() =>
        setLoadError(
          "تعذر فتح التخزين المحلي. تأكد من السماح بتخزين بيانات المواقع، ثم أعد المحاولة.",
        ),
      );
  };
  useEffect(boot, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setMenu(false);
  }, [location]);
  const rows = useMemo(
    () => (data ? filterRequests(data, filters, role === "employee" ? employeeId : undefined) : []),
    [data, filters, role, employeeId],
  );
  const m = metrics(rows);
  const detail = data?.requests.find((r) => r.id === detailId);
  const editing = data?.requests.find((r) => r.id === editId);
  const own = data?.employees.find((e) => e.id === employeeId);
  const activeFilters = [
    filters.employee,
    filters.company,
    filters.service,
    filters.status,
    filters.search,
  ].filter(Boolean).length;
  const updateFilter = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const go = (id: string) => navigate(navItems.find((n) => n.id === id)?.path ?? "/");
  async function commit(next: OperationsData, files: Attachment[] = []) {
    await saveData(next, files);
    setData(next);
  }
  async function saveRequest(r: RequestRecord, files: Attachment[]) {
    if (!data) return;
    const exists = data.requests.some((x) => x.id === r.id);
    await commit(
      {
        ...data,
        requests: exists
          ? data.requests.map((x) => (x.id === r.id ? r : x))
          : [r, ...data.requests],
      },
      files,
    );
    if (r.createdAt.slice(0, 10) < filters.from || r.createdAt.slice(0, 10) > filters.to)
      setFilters({
        ...emptyFilters,
        from: r.createdAt.slice(0, 10) < filters.from ? r.createdAt.slice(0, 10) : filters.from,
        to: r.createdAt.slice(0, 10) > filters.to ? r.createdAt.slice(0, 10) : filters.to,
      });
    else
      setFilters((f) => ({ ...f, company: "", employee: "", service: "", status: "", search: "" }));
    setToast(exists ? "تم حفظ التعديلات في هذا المتصفح" : "تم تسجيل الطلب وتحديث مؤشرات العمليات");
  }
  async function statusChange(status: Status) {
    if (!data || !detail || status === detail.status) return;
    const changed = {
      ...detail,
      status,
      history: [
        ...detail.history,
        {
          id: crypto.randomUUID(),
          status,
          time: new Date().toISOString(),
          actor: role === "manager" ? "مدير الطيران" : (own?.name ?? "موظف"),
          note: "تحديث حالة الطلب",
        },
      ],
    };
    await commit({
      ...data,
      requests: data.requests.map((r) => (r.id === changed.id ? changed : r)),
    });
    setToast("تم تحديث الحالة وتسجيلها في سجل النشاط");
  }
  async function saveCompany(c: Company) {
    if (!data) return;
    await commit({
      ...data,
      companies: data.companies.some((x) => x.id === c.id)
        ? data.companies.map((x) => (x.id === c.id ? c : x))
        : [...data.companies, c],
    });
    setToast("تم حفظ شركة العميل");
  }
  const canEdit = (r: RequestRecord) => role === "manager" || r.employeeId === employeeId;
  const title = {
    dashboard: role === "manager" ? "لوحة العمليات" : "مساحة العمل الخاصة بي",
    requests: role === "manager" ? "الطلبات والحجوزات" : "طلباتي والحجوزات",
    companies: "شركات العملاء",
    employees: "فريق الحجوزات",
    reports: "التقارير والأداء",
  }[current];
  const subtitle = {
    dashboard:
      role === "manager"
        ? "رؤية واضحة لكل طلب، وكل رحلة، وكل خطوة في عمليات فريقك."
        : "سجّل خدماتك وتابع طلباتك ومهامك من مكان واحد.",
    requests: "من التسجيل إلى الإنجاز؛ جميع تفاصيل العمليات في مكان واحد.",
    companies: "علاقات عمل منظمة، ومتابعة واضحة لنشاط كل شركة.",
    employees: "حجم العمل، الإنجاز، والمتابعة — مؤشرات واضحة دون ترتيب غير عادل.",
    reports: "قراءة دقيقة لعملياتك، مبنية على الطلبات المسجلة فقط.",
  }[current];
  return (
    <div className="app-shell" dir="rtl">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="brand" dir="ltr">
          <div className="brand-mark">
            <Plane size={29} strokeWidth={2.2} />
          </div>
          <div>
            <strong>
              MIDWAY<span>TRAVEL</span>
            </strong>
            <small>FLIGHT OPERATIONS</small>
          </div>
          <button
            className="mobile-close icon-button"
            onClick={() => setMenu(false)}
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-chip">
          <span className="workspace-icon">
            <BriefcaseBusiness size={17} />
          </span>
          <div>
            <strong>إدارة عمليات الطيران</strong>
            <small>مساحة عمل ميدواي</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-caption">مساحة العمليات</span>
        <nav>
          {navItems
            .filter((n) => role === "manager" || ["dashboard", "requests"].includes(n.id))
            .map((n) => (
              <button
                key={n.id}
                className={current === n.id ? "active" : ""}
                onClick={() => go(n.id)}
              >
                <n.icon size={19} />
                <span>{n.label}</span>
                {n.id === "requests" && data && (
                  <b className="nav-count numeric">
                    {role === "manager"
                      ? data.requests.filter(isPending).length
                      : data.requests.filter((r) => r.employeeId === employeeId && isPending(r))
                          .length}
                  </b>
                )}
                {current === n.id && <i />}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <span>
              <ShieldCheck size={17} />
              مساحة عرض تجريبية
            </span>
            <p>بيانات خيالية، دون اتصال بأنظمة الحجز أو شركات الطيران.</p>
            <button onClick={() => setInfo(true)}>
              عن هذه النسخة <ArrowUpLeft size={14} />
            </button>
          </div>
          <div className="sidebar-user">
            <span className="avatar orange">{role === "manager" ? "م ط" : own?.initials}</span>
            <div>
              <strong>{role === "manager" ? "مدير الطيران" : own?.name}</strong>
              <small>{role === "manager" ? "Aviation Manager" : "Reservation Employee"}</small>
            </div>
            <span className="online-dot" />
          </div>
          <div className="version" dir="ltr">
            MIDWAY OPERATIONS <span>v1.0 MVP</span>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-overlay"
          aria-label="إغلاق القائمة الجانبية"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button menu-button"
              aria-label="فتح القائمة"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>مساحة العمل</span>
            <ChevronLeft size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-tools">
            <span className="local-state">
              <i />
              حفظ محلي
            </span>
            <button
              className="icon-button info-button"
              aria-label="معلومات النسخة"
              onClick={() => setInfo(true)}
            >
              <Info size={18} />
            </button>
            <div className="role-control">
              <span className="demo-label">دور تجريبي</span>
              <select
                aria-label="تبديل الدور التجريبي"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setDetailId("");
                  setEditId("");
                  setNewRequest(false);
                  setCompanyDetail("");
                  setCompanyModal(null);
                  setFilters({ ...emptyFilters });
                  go("dashboard");
                }}
              >
                <option value="manager">مدير الطيران</option>
                <option value="employee">موظف حجوزات</option>
              </select>
            </div>
            {role === "employee" && data && (
              <select
                className="employee-switch"
                aria-label="اختيار الموظف التجريبي"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                {data.employees
                  .filter((e) => e.active)
                  .map((e) => (
                    <option value={e.id} key={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
            )}
            <span className={`avatar small ${role === "manager" ? "orange" : own?.color}`}>
              {role === "manager" ? "م ط" : own?.initials}
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span />
                MIDWAY FLIGHT OPERATIONS
              </div>
              <h1>
                {title}
                <span className="heading-mark">/</span>
              </h1>
              <p>{subtitle}</p>
            </div>
            <button className="button primary" onClick={() => setNewRequest(true)} disabled={!data}>
              <Plus size={18} />
              تسجيل طلب جديد
            </button>
          </div>
          <div className="demo-strip">
            <span>
              <Info size={14} />
              <b>نسخة تجريبية</b> البيانات والمرفقات محفوظة في هذا المتصفح فقط. تبديل الدور ليس نظام
              صلاحيات.
            </span>
            <button onClick={() => setInfo(true)}>
              التفاصيل <ArrowUpLeft size={13} />
            </button>
          </div>
          {!data ? (
            <div className="loading-panel">
              {loadError ? (
                <>
                  <AlertIcon />
                  <h3>{loadError}</h3>
                  <button className="button secondary" onClick={boot}>
                    <RefreshCw size={16} />
                    إعادة المحاولة
                  </button>
                </>
              ) : (
                <>
                  <div className="spinner" />
                  <h3>جارٍ تجهيز مساحة العمليات…</h3>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="filter-toolbar">
                <div className="period-label">
                  <CalendarDays size={17} />
                  <strong>الفترة المحددة</strong>
                </div>
                <div className="date-range">
                  <input
                    aria-label="من تاريخ"
                    type="date"
                    value={filters.from}
                    onChange={(e) => updateFilter("from", e.target.value)}
                    max={filters.to || undefined}
                  />
                  <ArrowRight size={13} />
                  <input
                    aria-label="إلى تاريخ"
                    type="date"
                    value={filters.to}
                    onChange={(e) => updateFilter("to", e.target.value)}
                    min={filters.from || undefined}
                  />
                </div>
                <div className="period-presets">
                  <button
                    className={
                      filters.from === "2026-10-01" && filters.to === "2026-10-18" ? "selected" : ""
                    }
                    onClick={() =>
                      setFilters((f) => ({ ...f, from: "2026-10-01", to: "2026-10-18" }))
                    }
                  >
                    هذا الشهر التجريبي
                  </button>
                  <button
                    className={
                      filters.from === "2026-10-12" && filters.to === "2026-10-18" ? "selected" : ""
                    }
                    onClick={() =>
                      setFilters((f) => ({ ...f, from: "2026-10-12", to: "2026-10-18" }))
                    }
                  >
                    آخر 7 أيام تجريبية
                  </button>
                </div>
                <div className="filter-actions">
                  <button
                    className={`button secondary small-btn ${filterOpen ? "selected" : ""}`}
                    onClick={() => setFilterOpen(!filterOpen)}
                  >
                    <SlidersHorizontal size={15} />
                    تصفية{activeFilters > 0 && <span className="count-tag">{activeFilters}</span>}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="تصدير الطلبات المصفاة CSV"
                    title="تصدير CSV"
                    onClick={() => {
                      exportCsv(data, rows);
                      setToast("تم تجهيز CSV للطلبات المطابقة للفلاتر دون مرفقات أو بيانات المسافر");
                    }}
                  >
                    <Download size={17} />
                  </button>
                </div>
              </div>
              {filterOpen && (
                <div className="expanded-filters">
                  <label>
                    بحث
                    <input
                      aria-label="البحث في الطلبات"
                      placeholder="مرجع، شركة، موظف، مسار…"
                      value={filters.search}
                      onChange={(e) => updateFilter("search", e.target.value)}
                    />
                  </label>
                  {role === "manager" && (
                    <label>
                      الموظف
                      <select
                        value={filters.employee}
                        onChange={(e) => updateFilter("employee", e.target.value)}
                      >
                        <option value="">كل الموظفين</option>
                        {data.employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    الشركة
                    <select
                      value={filters.company}
                      onChange={(e) => updateFilter("company", e.target.value)}
                    >
                      <option value="">كل الشركات</option>
                      {data.companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    نوع الخدمة
                    <select
                      value={filters.service}
                      onChange={(e) => updateFilter("service", e.target.value)}
                    >
                      <option value="">كل الخدمات</option>
                      {services.map((s) => (
                        <option key={s} value={s}>
                          {serviceNames[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    الحالة
                    <select
                      value={filters.status}
                      onChange={(e) => updateFilter("status", e.target.value)}
                    >
                      <option value="">كل الحالات</option>
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {statusNames[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="text-button" onClick={() => setFilters({ ...emptyFilters })}>
                    مسح الفلاتر
                  </button>
                </div>
              )}
              {filters.from && filters.to && filters.from > filters.to ? (
                <div className="error">تاريخ البداية يجب أن يسبق تاريخ النهاية.</div>
              ) : null}
              {current === "dashboard" && (
                <>
                  <div className="section-caption">
                    <span>
                      <Activity size={14} />
                      نظرة عامة على العمليات
                    </span>
                    <span>
                      حسب تاريخ إنشاء الطلب • {role === "manager" ? "جميع الموظفين" : "طلباتي فقط"}
                    </span>
                  </div>
                  <div className="kpi-grid">
                    {[
                      {
                        label: "إجمالي الطلبات",
                        value: m.total,
                        icon: FileText,
                        color: "blue",
                        note: "كل الخدمات والحالات في الفترة",
                      },
                      {
                        label: "تذاكر طيران صادرة",
                        value: m.issued,
                        icon: Plane,
                        color: "green",
                        note: `${m.completed} طلب مكتمل بجميع الخدمات`,
                      },
                      {
                        label: "طلبات قيد المتابعة",
                        value: m.pending,
                        icon: Clock3,
                        color: "orange",
                        note: `${m.waiting} طلب بانتظار المعلومات`,
                      },
                      {
                        label: "ملغي / مسترد",
                        value: m.closed,
                        icon: CircleX,
                        color: "purple",
                        note: `${rows.filter((r) => r.status === "cancelled").length} ملغي · ${rows.filter((r) => r.status === "refunded").length} مسترد`,
                      },
                    ].map((k) => (
                      <div className={`kpi-card ${k.color}`} key={k.label}>
                        <div>
                          <span>{k.label}</span>
                          <span className={`kpi-icon ${k.color}`}>
                            <k.icon size={20} />
                          </span>
                        </div>
                        <strong className="numeric">{num(k.value)}</strong>
                        <p>
                          <i />
                          {k.note}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="analytics-grid">
                    <VolumeChart rows={rows} from={filters.from} to={filters.to} />
                    <ServicesChart rows={rows} />
                  </div>
                  <div className="analytics-grid secondary-grid">
                    {role === "manager" ? (
                      <EmployeeChart
                        rows={rows}
                        employees={data.employees}
                        onView={() => go("employees")}
                      />
                    ) : (
                      <Panel
                        title="عبء العمل الخاص بي"
                        subtitle="طلباتك المفتوحة في الفترة المحددة"
                      >
                        <div className="workload-status">
                          {statuses.map((s) => (
                            <div key={s}>
                              <StatusBadge status={s} />
                              <strong className="numeric">
                                {rows.filter((r) => r.status === s).length}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </Panel>
                    )}
                    <Panel
                      title="طلبات تحتاج إلى متابعة"
                      subtitle="بانتظار المعلومات أولًا، ثم الأقدم بين الطلبات المفتوحة"
                      action={<span className="attention-count numeric">{m.pending}</span>}
                    >
                      <div className="attention-list">
                        {rows
                          .filter(isPending)
                          .sort(
                            (a, b) =>
                              Number(b.status === "waiting") - Number(a.status === "waiting") ||
                              a.createdAt.localeCompare(b.createdAt),
                          )
                          .slice(0, 3)
                          .map((r) => (
                            <button key={r.id} onClick={() => setDetailId(r.id)}>
                              <span
                                className={`attention-icon ${r.status === "waiting" ? "orange" : "blue"}`}
                              >
                                <Clock3 size={17} />
                              </span>
                              <span>
                                <strong>
                                  {data.companies.find((c) => c.id === r.companyId)?.name}
                                </strong>
                                <small>
                                  <b dir="ltr">{r.ref}</b> · {statusNames[r.status]}
                                </small>
                              </span>
                              <ChevronLeft size={16} />
                            </button>
                          ))}
                        {!m.pending && (
                          <div className="empty small-empty">
                            <CheckCheck size={23} />
                            <p>لا توجد طلبات مفتوحة في هذه الفترة.</p>
                          </div>
                        )}
                      </div>
                      <div className="attention-footer">
                        <Building2 size={15} />
                        <span>
                          <b className="numeric">
                            {role === "manager"
                              ? data.companies.filter((c) => c.active).length
                              : new Set(rows.map((r) => r.companyId)).size}
                          </b>{" "}
                          {role === "manager" ? "شركة عميل نشطة إجمالًا" : "شركة مرتبطة بطلباتك"}{" "}
                          <small>• {m.companies} شركة لها نشاط في الفلاتر</small>
                        </span>
                      </div>
                    </Panel>
                  </div>
                  <Panel
                    title="أحدث الطلبات"
                    subtitle="آخر العمليات المسجلة يدويًا ضمن الفترة المحددة"
                    action={
                      <button className="text-button" onClick={() => go("requests")}>
                        عرض جميع الطلبات <ArrowUpLeft size={14} />
                      </button>
                    }
                    className="table-panel"
                  >
                    <RequestsTable
                      rows={rows}
                      data={data}
                      onView={(r) => setDetailId(r.id)}
                      compact
                    />
                  </Panel>
                  <Panel
                    title="آخر تحديثات الحالة"
                    subtitle="سجل النشاط من نفس الطلبات المصفاة"
                    className="activity-panel"
                  >
                    <div className="recent-activity">
                      {rows
                        .flatMap((r) =>
                          r.history.map((h) => ({ ...h, ref: r.ref, requestId: r.id })),
                        )
                        .sort((a, b) => b.time.localeCompare(a.time))
                        .slice(0, 4)
                        .map((h) => (
                          <button key={h.id} onClick={() => setDetailId(h.requestId)}>
                            <span className="activity-point">
                              <Check size={14} />
                            </span>
                            <div>
                              <strong>{h.note}</strong>
                              <small>
                                <b dir="ltr">{h.ref}</b> • {h.actor}
                              </small>
                            </div>
                            <StatusBadge status={h.status} />
                            <time>{date(h.time, true)}</time>
                          </button>
                        ))}
                      {!rows.length && (
                        <div className="empty">لا توجد تحديثات في الفترة المحددة.</div>
                      )}
                    </div>
                  </Panel>
                </>
              )}
              {current === "requests" && (
                <>
                  <div className="list-summary">
                    <span>
                      <b className="numeric">{m.total}</b> طلب مسجل
                    </span>
                    <span>
                      <i className="dot green" />
                      {m.completed} مكتمل
                    </span>
                    <span>
                      <i className="dot orange" />
                      {m.pending} قيد المتابعة
                    </span>
                    <span>
                      <i className="dot muted" />
                      {m.closed} ملغي / مسترد
                    </span>
                  </div>
                  <Panel
                    title={role === "manager" ? "سجل الطلبات" : "سجل طلباتي"}
                    subtitle="ابحث أو افتح الطلب لعرض التفاصيل والمرفقات وسجل الحالة"
                    action={
                      <div className="search-box">
                        <Search size={16} />
                        <input
                          aria-label="البحث في سجل الطلبات"
                          placeholder="ابحث عن طلب…"
                          value={filters.search}
                          onChange={(e) => updateFilter("search", e.target.value)}
                        />
                      </div>
                    }
                    className="table-panel"
                  >
                    <RequestsTable rows={rows} data={data} onView={(r) => setDetailId(r.id)} />
                  </Panel>
                </>
              )}
              {current === "companies" && role === "manager" && (
                <>
                  <div className="directory-heading">
                    <div>
                      <span className="numeric">
                        {data.companies.filter((c) => c.active).length}
                      </span>{" "}
                      شركة نشطة <small>المؤشرات أدناه حسب الفلاتر المحددة</small>
                    </div>
                    <div className="directory-actions">
                      <div className="search-box">
                        <Search size={16} />
                        <input
                          placeholder="ابحث عن شركة…"
                          aria-label="البحث في الشركات"
                          value={companySearch}
                          onChange={(e) => setCompanySearch(e.target.value)}
                        />
                      </div>
                      <button className="button secondary" onClick={() => setCompanyModal("new")}>
                        <Plus size={16} />
                        إضافة شركة
                      </button>
                    </div>
                  </div>
                  <div className="company-grid">
                    {data.companies
                      .filter((c) => `${c.name} ${c.contact}`.includes(companySearch))
                      .map((c, i) => {
                        const related = rows.filter((r) => r.companyId === c.id);
                        const cm = metrics(related);
                        const all = data.requests
                          .filter((r) => r.companyId === c.id)
                          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                        const totals = finances(related);
                        return (
                          <article className="company-card panel" key={c.id}>
                            <div className="company-card-top">
                              <span
                                className={`company-logo ${["blue", "purple", "green", "orange"][i % 4]}`}
                              >
                                <Building2 size={23} />
                              </span>
                              <span className={`active-label ${!c.active ? "inactive" : ""}`}>
                                <i />
                                {c.active ? "نشطة" : "غير نشطة"}
                              </span>
                              <button
                                className="icon-button"
                                aria-label={`تعديل ${c.name}`}
                                onClick={() => setCompanyModal(c)}
                              >
                                <SlidersHorizontal size={16} />
                              </button>
                            </div>
                            <h3>{c.name}</h3>
                            <p>{c.contact || "مسؤول التواصل غير مسجل"}</p>
                            <div className="company-metrics">
                              <div>
                                <b className="numeric">{cm.total}</b>
                                <span>إجمالي الطلبات</span>
                              </div>
                              <div>
                                <b className="numeric green-text">{cm.issued}</b>
                                <span>تذاكر صادرة</span>
                              </div>
                              <div>
                                <b className="numeric orange-text">{cm.pending}</b>
                                <span>قيد المتابعة</span>
                              </div>
                            </div>
                            <div className="company-finance">
                              <span>عمولات مسجلة</span>
                              <b className="numeric">
                                {totals.length
                                  ? totals
                                      .map((f) => `${num(f.commission)} ${f.currency}`)
                                      .join(" · ")
                                  : "غير متاحة"}
                              </b>
                            </div>
                            <div className="company-card-footer">
                              <span>
                                آخر نشاط:{" "}
                                {all[0]
                                  ? date(all[0].history.at(-1)?.time ?? all[0].createdAt)
                                  : "لا يوجد"}
                              </span>
                              <button
                                className="text-button"
                                onClick={() => setCompanyDetail(c.id)}
                              >
                                عرض الشركة <ChevronLeft size={14} />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                  {!data.companies.some((c) =>
                    `${c.name} ${c.contact}`.includes(companySearch),
                  ) && (
                    <div className="empty">
                      <Building2 size={30} />
                      <h4>لا توجد شركة مطابقة</h4>
                    </div>
                  )}
                </>
              )}
              {current === "employees" && role === "manager" && (
                <>
                  <div className="section-caption">
                    <span>
                      <UsersRound size={15} />
                      {data.employees.filter((e) => e.active).length} موظفين نشطين
                    </span>
                    <span>عدد الطلبات لا يقيس جودة الخدمة أو صعوبة العمليات</span>
                  </div>
                  <div className="employee-grid">
                    {data.employees.map((e) => {
                      const related = rows.filter((r) => r.employeeId === e.id);
                      const em = metrics(related);
                      const last = [...related].sort((a, b) =>
                        (b.history.at(-1)?.time ?? b.createdAt).localeCompare(
                          a.history.at(-1)?.time ?? a.createdAt,
                        ),
                      )[0];
                      return (
                        <article className="employee-card panel" key={e.id}>
                          <div className="employee-card-header">
                            <span className={`avatar large ${e.color}`}>{e.initials}</span>
                            <div>
                              <h3>{e.name}</h3>
                              <p>
                                {e.role} <span className="latin">• {e.code}</span>
                              </p>
                            </div>
                            <span className={`active-label ${!e.active ? "inactive" : ""}`}>
                              <i />
                              {e.active ? "نشط" : "غير نشط"}
                            </span>
                          </div>
                          <div className="employee-stats">
                            <div>
                              <b className="numeric">{em.total}</b>
                              <span>طلبات مسجلة</span>
                            </div>
                            <div>
                              <b className="numeric green-text">{em.completed}</b>
                              <span>طلبات مكتملة</span>
                            </div>
                            <div>
                              <b className="numeric orange-text">{em.pending}</b>
                              <span>قيد المتابعة</span>
                            </div>
                          </div>
                          <div className="completion-line">
                            <span>
                              حصة الطلبات المكتملة <small>• ليست تقييمًا للأداء</small>
                            </span>
                            <b className="numeric">
                              {em.total ? Math.round((em.completed / em.total) * 100) : 0}%
                            </b>
                          </div>
                          <div className="progress-track">
                            <i
                              style={{
                                width: `${em.total ? (em.completed / em.total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <div className="employee-card-footer">
                            <small>
                              آخر نشاط في الفترة:{" "}
                              {last
                                ? date(last.history.at(-1)?.time ?? last.createdAt, true)
                                : "لا يوجد"}
                            </small>
                            <button
                              className="text-button"
                              onClick={() => {
                                updateFilter("employee", e.id);
                                go("requests");
                              }}
                            >
                              عرض الطلبات <ArrowUpLeft size={14} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <EmployeeChart rows={rows} employees={data.employees} />
                  <Panel
                    title="تذاكر الطيران الصادرة حسب الموظف"
                    subtitle="تذاكر جديدة مكتملة فقط، دون التعديلات أو الاستردادات"
                  >
                    <div className="issued-comparison">
                      {data.employees.map((e) => (
                        <div key={e.id}>
                          <span>{e.name}</span>
                          <strong className="numeric">
                            {rows.filter((r) => r.employeeId === e.id && isIssued(r)).length}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </>
              )}
              {current === "reports" && role === "manager" && (
                <>
                  <div className="report-intro">
                    <span className="report-icon">
                      <ChartNoAxesCombined size={24} />
                    </span>
                    <div>
                      <strong>العمليات كما هي، دون أرقام تقديرية</strong>
                      <p>
                        {m.total} طلب في الفترة • {m.completed} مكتمل • {m.issued} تذكرة طيران
                        صادرة. جميع المخططات تستخدم نفس الفلاتر.
                      </p>
                    </div>
                    <button className="button secondary" onClick={() => exportCsv(data, rows)}>
                      <Download size={16} />
                      تصدير CSV
                    </button>
                  </div>
                  <div className="analytics-grid">
                    <VolumeChart rows={rows} from={filters.from} to={filters.to} />
                    <ServicesChart rows={rows} />
                  </div>
                  <div className="analytics-grid secondary-grid">
                    <EmployeeChart rows={rows} employees={data.employees} />
                    <Panel
                      title="عبء العمل حسب الحالة"
                      subtitle="توزيع حصري، دون احتساب الطلب مرتين"
                    >
                      <div className="workload-status">
                        {statuses.map((s) => (
                          <div key={s}>
                            <StatusBadge status={s} />
                            <div className="status-bar">
                              <i
                                style={{
                                  width: `${m.total ? (rows.filter((r) => r.status === s).length / m.total) * 100 : 0}%`,
                                }}
                                className={s}
                              />
                            </div>
                            <strong className="numeric">
                              {rows.filter((r) => r.status === s).length}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                  <FinancialPanel rows={rows} />
                  <Panel
                    title="نشاط شركات العملاء"
                    subtitle="حسب تاريخ إنشاء الطلب في الفترة المحددة"
                    className="table-panel"
                  >
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>شركة العميل</th>
                            <th>إجمالي الطلبات</th>
                            <th>تذاكر طيران صادرة</th>
                            <th>كل الخدمات المكتملة</th>
                            <th>قيد المتابعة</th>
                            <th>آخر طلب في الفترة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.companies.map((c) => {
                            const own = rows.filter((r) => r.companyId === c.id);
                            const cm = metrics(own);
                            return (
                              <tr key={c.id}>
                                <td>{c.name}</td>
                                <td className="numeric">{cm.total}</td>
                                <td className="numeric green-text">{cm.issued}</td>
                                <td className="numeric">{cm.completed}</td>
                                <td className="numeric orange-text">{cm.pending}</td>
                                <td>{own[0] ? date(own[0].createdAt) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                  <Panel
                    title="إصدار التذاكر حسب الموظف"
                    subtitle="تذاكر طيران جديدة فقط — تستبعد التعديل والاسترداد والإلغاء"
                  >
                    <div className="issued-comparison">
                      {data.employees.map((e) => (
                        <div key={e.id}>
                          <span>{e.name}</span>
                          <strong className="numeric">
                            {rows.filter((r) => r.employeeId === e.id && isIssued(r)).length}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </>
              )}
              {role === "employee" && ["companies", "employees", "reports"].includes(current) && (
                <div className="empty">
                  <h3>هذه الشاشة ضمن تجربة المدير</h3>
                  <button className="button secondary" onClick={() => go("dashboard")}>
                    العودة لمساحة العمل
                  </button>
                </div>
              )}
              <footer className="page-footer">
                <span>
                  <Plane size={13} />
                  Midway Flight Operations <i />
                  تسجيل يدوي، رؤية موحدة
                </span>
                <span>بيانات خيالية • تخزين محلي غير متزامن</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {data && newRequest && (
        <RequestForm
          data={data}
          employeeId={employeeId}
          role={role}
          onClose={() => setNewRequest(false)}
          onSave={saveRequest}
        />
      )}
      {data && editing && canEdit(editing) && (
        <RequestForm
          data={data}
          employeeId={employeeId}
          role={role}
          initial={editing}
          onClose={() => setEditId("")}
          onSave={saveRequest}
        />
      )}
      {data && detail && (role === "manager" || detail.employeeId === employeeId) && (
        <RequestDetail
          record={detail}
          data={data}
          canEdit={canEdit(detail)}
          onClose={() => setDetailId("")}
          onEdit={() => {
            setEditId(detail.id);
            setDetailId("");
          }}
          onStatus={statusChange}
        />
      )}
      {data && companyModal && role === "manager" && (
        <CompanyForm
          data={data}
          initial={companyModal === "new" ? undefined : companyModal}
          onClose={() => setCompanyModal(null)}
          onSave={saveCompany}
        />
      )}
      {data &&
        companyDetail &&
        role === "manager" &&
        (() => {
          const c = data.companies.find((c) => c.id === companyDetail);
          if (!c) return null;
          const own = rows.filter((r) => r.companyId === c.id);
          const cm = metrics(own);
          return (
            <Modal
              title={c.name}
              subtitle="ملف شركة العميل • المؤشرات حسب الفلاتر الحالية"
              onClose={() => setCompanyDetail("")}
              wide
            >
              <div className="form-body">
                <div className="detail-grid">
                  {[
                    ["مسؤول التواصل", c.contact || "غير مسجل"],
                    ["بيانات التواصل", c.details || "غير مسجل"],
                    ["الحالة", c.active ? "نشطة" : "غير نشطة"],
                    ["الطلبات / المكتملة", `${cm.total} / ${cm.completed}`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <span>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
                <p className="note-box">{c.notes || "لا توجد ملاحظات."}</p>
                <FinancialPanel rows={own} />
                <h4>الطلبات المرتبطة</h4>
                <RequestsTable
                  rows={own}
                  data={data}
                  compact
                  onView={(r) => {
                    setCompanyDetail("");
                    setDetailId(r.id);
                  }}
                />
              </div>
              <div className="modal-footer">
                <button
                  className="button secondary"
                  onClick={() => {
                    setCompanyDetail("");
                    setCompanyModal(c);
                  }}
                >
                  تعديل الشركة
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    updateFilter("company", c.id);
                    setCompanyDetail("");
                    go("requests");
                  }}
                >
                  عرض كل طلبات الشركة
                </button>
              </div>
            </Modal>
          );
        })()}
      {info && (
        <Modal
          title="عن النسخة التجريبية"
          subtitle="Midway Flight Operations — MVP"
          onClose={() => setInfo(false)}
        >
          <div className="form-body about-content">
            <div className="about-icon">
              <ShieldCheck size={30} />
            </div>
            <h3>مساحة عمل حقيقية للعرض، وليست نظام حجز مباشرًا</h3>
            <p>
              يمكنك تسجيل الطلبات وتعديل حالاتها، إدارة الشركات، معاينة المرفقات، ومراجعة مؤشرات
              مشتقة من نفس السجلات.
            </p>
            <ul>
              <li>
                جميع السجلات الأولية لشركات وموظفين وطلبات خيالية. الفترة الأولية 1–18 أكتوبر 2026.
              </li>
              <li>
                التخزين في IndexedDB داخل هذا المتصفح فقط. يُحفظ بعد إعادة تحميل الصفحة، لكنه لا
                يتزامن بين الأجهزة أو الموظفين، ويمكن فقده عند مسح بيانات الموقع.
              </li>
              <li>
                المرفقات محلية ولا تُرفع إلى خدمة عامة. لا تدخل أسماء مسافرين أو مستندات سرية حقيقية في
                العرض.
              </li>
              <li>
                تبديل الدور والموظف تجربة واجهة، وليس مصادقة أو صلاحيات وصول. الموظف يرى طلباته ضمن
                هذه التجربة فقط.
              </li>
              <li>
                لا توجد اتصالات WhatsApp أو GDS أو شركات طيران؛ إكمال طلب هنا لا يُصدر تذكرة حقيقية.
              </li>
              <li>
                المؤشرات حسب تاريخ إنشاء الطلب وحالته الحالية. التذكرة الصادرة = خدمة طيران جديدة
                مكتملة. التقارير المالية تستخدم القيم المسجلة للطلبات المكتملة وتفصل العملات.
              </li>
            </ul>
            <div className="next-step">
              <strong>المرحلة التالية المقترحة</strong>
              <p>
                مصادقة فعلية وصلاحيات على الخادم، قاعدة بيانات مشتركة، وتخزين خاص للمستندات قبل إدخال
                أي بيانات عمل حقيقية.
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button className="button primary" onClick={() => setInfo(false)}>
              فهمت
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <output className="toast">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button onClick={() => setToast("")} aria-label="إغلاق الإشعار">
            <X size={15} />
          </button>
        </output>
      )}
    </div>
  );
}
function AlertIcon() {
  return <Info size={30} />;
}
