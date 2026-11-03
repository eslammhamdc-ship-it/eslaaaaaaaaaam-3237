import { ArrowUpLeft, BarChart3 } from "lucide-react";
import {
  metrics,
  num,
  services,
  serviceNames,
  volume,
  isPending,
  type RequestRecord,
  type Employee,
} from "../lib/operations";
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function VolumeChart({
  rows,
  from,
  to,
}: {
  rows: RequestRecord[];
  from: string;
  to: string;
}) {
  const { bins, weekly } = volume(rows, from, to);
  const max = Math.max(4, ...bins.map((b) => b.total));
  const ticks = [0, Math.ceil(max / 3), Math.ceil((max * 2) / 3), max];
  const x = (i: number) => 50 + (i * 650) / Math.max(1, bins.length - 1);
  const y = (n: number) => 172 - (n / max) * 138;
  const total = bins.map((b, i) => `${x(i)},${y(b.total)}`).join(" ");
  const complete = bins.map((b, i) => `${x(i)},${y(b.completed)}`).join(" ");
  const labels = bins.filter(
    (_, i) => i % Math.max(1, Math.ceil(bins.length / 7)) === 0 || i === bins.length - 1,
  );
  return (
    <Panel
      title="حركة الطلبات"
      subtitle={
        weekly
          ? "حجم العمليات الأسبوعي خلال الفترة المحددة"
          : "حجم العمليات اليومي خلال الفترة المحددة"
      }
      action={
        <span className="subtle-tag">
          {weekly ? "أسبوعي" : "يومي"} <BarChart3 size={13} />
        </span>
      }
    >
      <div className="chart-legend">
        <span>
          <i className="dot blue" />
          إجمالي الطلبات
        </span>
        <span>
          <i className="dot green" />
          الطلبات المكتملة
        </span>
      </div>
      {!bins.length ? (
        <div className="empty">لا توجد بيانات في الفترة المحددة</div>
      ) : (
        <svg
          className="line-chart"
          viewBox="0 0 735 214"
          aria-label="حجم الطلبات المسجلة والمكتملة حسب تاريخ إنشاء الطلب"
          style={{ direction: "ltr" }}
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#70baff" stopOpacity=".19" />
              <stop offset="100%" stopColor="#70baff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((n, i) => (
            <g key={i}>
              <line x1="45" x2="711" y1={y(n)} y2={y(n)} stroke="#243147" strokeDasharray="3 5" />
              <text x="25" y={y(n) + 4} fill="#8091a8" fontSize="11" textAnchor="middle">
                {n}
              </text>
            </g>
          ))}
          <polygon points={`50,172 ${total} ${x(bins.length - 1)},172`} fill="url(#chart-fill)" />
          <polyline
            points={total}
            fill="none"
            stroke="#70baff"
            strokeWidth="2.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            points={complete}
            fill="none"
            stroke="#4bd5ab"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinejoin="round"
          />
          {bins.map((b, i) => (
            <circle
              key={b.day}
              cx={x(i)}
              cy={y(b.total)}
              r="3"
              fill="#101c2e"
              stroke="#70baff"
              strokeWidth="1.5"
            >
              <title>
                {b.day}: {b.total} طلب، {b.completed} مكتمل
              </title>
            </circle>
          ))}
          {labels.map((b) => (
            <text
              key={b.day}
              x={x(bins.indexOf(b))}
              y="203"
              fill="#8091a8"
              fontSize="10"
              textAnchor="middle"
            >
              {new Date(b.day + "T12:00:00Z").toLocaleDateString("ar-EG", {
                day: "numeric",
                month: "short",
              })}
            </text>
          ))}
        </svg>
      )}
    </Panel>
  );
}
const colors = ["#70baff", "#ff974d", "#ac94f8", "#4bd5ab", "#e9c66c", "#6982a0"];
export function ServicesChart({ rows }: { rows: RequestRecord[] }) {
  const counts = services.map((s, i) => ({
    name: serviceNames[s],
    count: rows.filter((r) => r.service === s).length,
    color: colors[i]!,
  }));
  let position = 0;
  const gradient = counts
    .map((c) => {
      const start = position;
      position += rows.length ? (c.count / rows.length) * 100 : 0;
      return `${c.color} ${start}% ${position}%`;
    })
    .join(",");
  return (
    <Panel title="توزيع الخدمات" subtitle="كل طلب يُحتسب في خدمة واحدة فقط">
      <div className="services-chart">
        <div
          className="donut"
          style={{ background: rows.length ? `conic-gradient(${gradient})` : "#223047" }}
        >
          <div>
            <strong className="numeric">{num(rows.length)}</strong>
            <span>إجمالي الطلبات</span>
          </div>
        </div>
        <div className="donut-legend">
          {counts.map((c) => (
            <div key={c.name}>
              <span>
                <i className="dot" style={{ background: c.color }} />
                {c.name}
              </span>
              <b className="numeric">
                {c.count}
                <small>{rows.length ? Math.round((c.count / rows.length) * 100) : 0}%</small>
              </b>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
export function EmployeeChart({
  rows,
  employees,
  onView,
}: {
  rows: RequestRecord[];
  employees: Employee[];
  onView?: () => void;
}) {
  const max = Math.max(
    1,
    ...employees.map((e) => rows.filter((r) => r.employeeId === e.id).length),
  );
  return (
    <Panel
      title="نشاط فريق الحجوزات"
      subtitle="حجم العمل حسب الحالة — ليس ترتيبًا للأداء"
      action={
        onView && (
          <button className="text-button" onClick={onView}>
            عرض الفريق <ArrowUpLeft size={14} />
          </button>
        )
      }
    >
      <div className="chart-legend">
        <span>
          <i className="dot blue" />
          مكتمل
        </span>
        <span>
          <i className="dot orange" />
          قيد المتابعة
        </span>
        <span>
          <i className="dot muted" />
          ملغي / مسترد
        </span>
      </div>
      <div className="employee-chart">
        {employees.map((e) => {
          const own = rows.filter((r) => r.employeeId === e.id);
          const m = metrics(own);
          return (
            <div className="employee-bar" key={e.id}>
              <span className={`avatar ${e.color}`}>{e.initials}</span>
              <span className="employee-name">
                {e.name}
                <small>{own.filter(isPending).length} طلب قيد المتابعة</small>
              </span>
              <div className="bar-track">
                <span style={{ width: `${(m.completed / max) * 100}%` }} className="blue" />
                <span style={{ width: `${(m.pending / max) * 100}%` }} className="orange" />
                <span style={{ width: `${(m.closed / max) * 100}%` }} className="muted" />
              </div>
              <b className="numeric">{own.length}</b>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
