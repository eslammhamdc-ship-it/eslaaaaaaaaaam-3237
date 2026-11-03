import { CalendarDays, AlertCircle, ArrowLeft, Download } from "lucide-react";
import { download, fmt, type Row } from "../lib/crm";
const escapeICS = (v: string) =>
  String(v || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const stamp = (v: string) =>
  new Date(v)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z/, "Z");
export function exportCalendar(tasks: Row[], companies: Row[]) {
  const events = tasks
    .filter((t) => t.data.status !== "done" && t.data.due)
    .flatMap((t) => {
      const start = new Date(t.data.due),
        end = new Date(start.getTime() + 30 * 60000);
      const name = companies.find((c) => c.id === t.companyId)?.data.name || "";
      return [
        "BEGIN:VEVENT",
        `UID:${t.id}@eslam-b2b-sales`,
        `DTSTAMP:${stamp(new Date().toISOString())}`,
        `DTSTART:${stamp(start.toISOString())}`,
        `DTEND:${stamp(end.toISOString())}`,
        `SUMMARY:${escapeICS(`${name} — ${t.data.action}`)}`,
        `DESCRIPTION:${escapeICS(`${t.data.channel || ""} · ${t.data.contact || ""}`)}`,
        "BEGIN:VALARM",
        "TRIGGER:-PT15M",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeICS(t.data.action)}`,
        "END:VALARM",
        "END:VEVENT",
      ];
    });
  download(
    "eslam-followups.ics",
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Eslam B2B//Sales CRM//AR",
      "CALSCALE:GREGORIAN",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n") + "\r\n",
    "text/calendar;charset=utf-8",
  );
}
export function CalendarExport({ tasks, companies }: { tasks: Row[]; companies: Row[] }) {
  return (
    <div className="calendar-export panel">
      <div>
        <h3>
          <CalendarDays size={18} /> مواعيدك في تقويمك
        </h3>
        <p>
          صدّر المواعيد المفتوحة إلى ملف ICS واستورده في Google Calendar أو Outlook أو تقويم هاتفك.
          يتضمن تذكيرًا مقترحًا قبل الموعد بـ١٥ دقيقة.
        </p>
        <small>
          التنبيه يعتمد على إعدادات تطبيق التقويم؛ لا توجد مزامنة تلقائية. عند إعادة الجدولة احذف
          الموعد القديم أو حدثه في تقويمك.
        </small>
      </div>
      <button
        className="secondary"
        disabled={!tasks.some((t) => t.data.due && t.data.status !== "done")}
        onClick={() => exportCalendar(tasks, companies)}
      >
        <Download size={17} />
        تصدير للتقويم
      </button>
    </div>
  );
}
export function ActionGaps({
  visits,
  tasks,
  companies,
  open,
}: {
  visits: Row[];
  tasks: Row[];
  companies: Row[];
  open: (companyId: string) => void;
}) {
  const gaps = visits
    .filter(
      (v) =>
        !v.data.nextAction &&
        !tasks.some((t) => t.companyId === v.companyId && t.data.status !== "done"),
    )
    .sort((a, b) => b.data.date.localeCompare(a.data.date));
  return (
    <section className="panel section-gap action-gaps">
      <div className="section-heading">
        <div>
          <h3>
            <AlertCircle size={17} /> زيارات بدون خطوة تالية
          </h3>
          <p>قائمة مراجعة، وليست مهام تُنشأ تلقائيًا. لا تظهر شركة لها متابعة مفتوحة.</p>
        </div>
        <span className="tag amber">{gaps.length.toLocaleString("ar-EG")}</span>
      </div>
      {gaps.length ? (
        gaps.slice(0, 5).map((v) => (
          <div className="gap-row" key={v.id}>
            <div>
              <strong>{companies.find((c) => c.id === v.companyId)?.data.name}</strong>
              <small>
                {fmt(v.data.date)} · {v.data.outcome || "نتيجة غير مسجلة"}
              </small>
            </div>
            <button className="text-btn" onClick={() => open(v.companyId!)}>
              حدد خطوة <ArrowLeft size={15} />
            </button>
          </div>
        ))
      ) : (
        <p className="help">لا توجد زيارات تحتاج مراجعة الخطوة التالية حاليًا.</p>
      )}
    </section>
  );
}
