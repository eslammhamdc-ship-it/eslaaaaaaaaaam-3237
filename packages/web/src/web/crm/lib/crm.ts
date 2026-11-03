export type Row = {
  ownerId?: string;
  id: string;
  kind: string;
  companyId: string | null;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};
export { statuses, stages } from "../../../shared/constants";
import { statuses, stages } from "../../../shared/constants";
export const services = [
  "تذاكر طيران",
  "تعديل التذاكر",
  "أسعار وعمولات خاصة",
  "تأشيرات",
  "مجموعات وبرامج عمرة",
  "خدمات سياحية أخرى",
];
export const visitTypes = [
  "أول زيارة",
  "متابعة",
  "بناء علاقة",
  "عرض خدمات",
  "تفاوض",
  "حل شكوى",
  "إعادة تنشيط",
];
export const channels = ["زيارة ميدانية", "تليفون", "واتساب", "بريد إلكتروني"];
export const outcomes = [
  "مهتم بالخدمات",
  "محتاج متابعة",
  "طلب عرض سعر",
  "تم الاتفاق على تجربة",
  "غير مهتم حاليًا",
  "حل مشكلة",
  "لم تتم المقابلة",
];
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateKey = (v: string) =>
  v
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(v))
    : "";
export const fmt = (v: string, time = false) =>
  v
    ? new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "medium",
        ...(time ? { timeStyle: "short" } : {}),
        timeZone: "Africa/Cairo",
      }).format(new Date(v))
    : "بدون موعد";
export const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const dueState = (r: Row) =>
  r.data.status === "done"
    ? "done"
    : !r.data.due
      ? "unscheduled"
      : dateKey(r.data.due) < today()
        ? "overdue"
        : dateKey(r.data.due) === today()
          ? "today"
          : "upcoming";
export function mapLink(c: Row) {
  return String(c.data.maps || "").startsWith("https://")
    ? c.data.maps
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.data.name, c.data.address, c.data.neighborhood, c.data.city].filter(Boolean).join(" "))}`;
}
export function download(name: string, text: string, type = "text/plain") {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function csv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const cell = (x: any) =>
    '"' +
    String(
      Array.isArray(x) ? x.join(" | ") : x && typeof x === "object" ? JSON.stringify(x) : (x ?? ""),
    )
      .replace(/^[=+@-]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  return (
    "﻿" +
    [keys.map(cell).join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join(
      "\r\n",
    )
  );
}
export function parseCSV(text: string) {
  const lines: string[][] = [];
  let row: string[] = [],
    s = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        s += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(s);
      s = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(s);
      if (row.some(Boolean)) lines.push(row);
      row = [];
      s = "";
    } else s += c;
  }
  row.push(s);
  if (row.some(Boolean)) lines.push(row);
  if (quoted) throw Error("ملف CSV غير صحيح");
  const headers = lines.shift()?.map((h) => h.replace(/^﻿/, "").trim()) || [];
  return lines.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || ""])));
}
export const defaults = (kind: string, companyId = "") =>
  kind === "company"
    ? {
        name: "",
        status: statuses[0],
        priority: "B",
        stage: stages[0],
        contacts: [],
        usedServices: [],
        neededServices: [],
      }
    : kind === "visit"
      ? {
          companyId,
          date: localNow(),
          type: visitTypes[0],
          interest: "متوسط",
          services: [],
          outcome: outcomes[1],
          channel: channels[2],
        }
      : kind === "followup"
        ? { companyId, action: "", due: "", priority: "B", channel: channels[2], status: "pending" }
        : kind === "opportunity"
          ? { companyId, stage: stages[0], service: services[0] }
          : kind === "stop"
            ? { companyId, date: today(), order: 1, status: "planned" }
            : { companyId, text: "", channel: "ملاحظة" };
export type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean;
  wide?: boolean;
};
export const fields: Record<string, Field[]> = {
  company: [
    { key: "name", label: "اسم الشركة", required: true },
    {
      key: "category",
      label: "النشاط / التخصص",
      options: ["شركة سياحة", "وكالة سفر", "حج وعمرة", "سياحة داخلية", "أخرى"],
    },
    { key: "status", label: "تصنيف العميل", options: statuses },
    { key: "priority", label: "الأولوية", options: ["A", "B", "C"] },
    { key: "phone", label: "رقم التليفون", type: "tel" },
    { key: "whatsapp", label: "رقم واتساب", type: "tel" },
    { key: "city", label: "المدينة" },
    { key: "governorate", label: "المحافظة" },
    { key: "neighborhood", label: "المنطقة / الحي" },
    { key: "address", label: "العنوان بالتفصيل", wide: true },
    { key: "latitude", label: "خط العرض المؤكد (اختياري)", type: "number" },
    { key: "longitude", label: "خط الطول المؤكد (اختياري)", type: "number" },
    { key: "opensAt", label: "بداية العمل — لو معروفة", type: "time" },
    { key: "closesAt", label: "نهاية العمل — لو معروفة", type: "time" },
    { key: "maps", label: "رابط Google Maps", type: "url" },
    { key: "email", label: "البريد الإلكتروني", type: "email" },
    { key: "website", label: "الموقع الإلكتروني", type: "url" },
    { key: "social", label: "روابط التواصل الاجتماعي", type: "textarea" },
    {
      key: "size",
      label: "حجم الشركة التقريبي",
      options: ["غير معروف", "صغيرة", "متوسطة", "كبيرة"],
    },
    {
      key: "source",
      label: "مصدر العميل",
      options: ["زيارة ميدانية", "ترشيح", "معرض / فعالية", "اتصال وارد", "تواصل اجتماعي", "أخرى"],
    },
    {
      key: "relationship",
      label: "حالة العلاقة",
      options: ["لم يبدأ التواصل", "تواصل أولي", "علاقة جيدة", "يحتاج اهتمام", "متوقف"],
    },
    { key: "stage", label: "مرحلة مسار البيع", options: stages },
    { key: "usedServices", label: "الخدمات المستخدمة حاليًا", type: "multi", options: services },
    { key: "neededServices", label: "الخدمات التي قد يحتاجها", type: "multi", options: services },
    { key: "notes", label: "ملاحظات", type: "textarea", wide: true },
  ],
  visit: [
    { key: "companyId", label: "الشركة", type: "company", required: true },
    { key: "date", label: "تاريخ ووقت الزيارة", type: "datetime-local", required: true },
    { key: "type", label: "نوع الزيارة", options: visitTypes },
    { key: "contact", label: "اسم الشخص الذي قابلته" },
    {
      key: "role",
      label: "وظيفته",
      options: ["مالك", "مدير", "موظف تذاكر", "مسؤول مشتريات", "أخرى"],
    },
    { key: "outcome", label: "نتيجة الزيارة", options: outcomes },
    { key: "services", label: "الخدمات التي يهتم بها العميل", type: "multi", options: services },
    { key: "customerStatus", label: "تصنيف العميل وقت الزيارة", options: statuses },
    { key: "priority", label: "الأولوية", options: ["A", "B", "C"] },
    { key: "interest", label: "مستوى الاهتمام", options: ["مرتفع", "متوسط", "منخفض", "غير معروف"] },
    { key: "notes", label: "ملخص المقابلة", type: "textarea", wide: true },
    { key: "nextAction", label: "الخطوة الجاية المتفق عليها", wide: true },
    { key: "nextDue", label: "موعد المتابعة القادمة", type: "datetime-local" },
    { key: "channel", label: "طريقة المتابعة", options: channels },
  ],
  followup: [
    { key: "companyId", label: "الشركة", type: "company", required: true },
    { key: "contact", label: "الشخص المسؤول" },
    { key: "action", label: "المطلوب في المتابعة", required: true, wide: true },
    { key: "due", label: "الموعد (يمكن تركه فارغًا)", type: "datetime-local" },
    { key: "priority", label: "الأولوية", options: ["A", "B", "C"] },
    { key: "channel", label: "طريقة التواصل", options: channels },
    { key: "visitId", label: "زيارة مرتبطة", type: "visit" },
    { key: "opportunityId", label: "فرصة بيع مرتبطة", type: "opportunity" },
    { key: "status", label: "الحالة", options: ["pending", "done"] },
    { key: "completionNotes", label: "ملاحظات الإتمام", type: "textarea", wide: true },
  ],
  opportunity: [
    { key: "companyId", label: "الشركة", type: "company", required: true },
    { key: "visitId", label: "الزيارة التي نتجت عنها الفرصة — اختياري", type: "visit" },
    { key: "description", label: "وصف فرصة البيع", required: true, wide: true },
    { key: "service", label: "الخدمة", options: services },
    { key: "stage", label: "المرحلة", options: stages },
    { key: "value", label: "قيمة تقديرية (جنيه) — لو معروفة", type: "number" },
    { key: "probability", label: "احتمال النجاح % — اختياري", type: "number" },
    { key: "expectedClose", label: "موعد الإغلاق المتوقع", type: "date" },
    { key: "obstacle", label: "العائق الأساسي", type: "textarea" },
    { key: "nextAction", label: "الخطوة القادمة", type: "textarea" },
    { key: "reason", label: "نتيجة الفرصة وسبب الفوز / الخسارة", type: "textarea", wide: true },
  ],
  stop: [
    { key: "companyId", label: "الشركة", type: "company", required: true },
    { key: "date", label: "يوم الزيارة", type: "date", required: true },
    { key: "time", label: "الوقت المتوقع", type: "time" },
    { key: "order", label: "ترتيب الزيارة", type: "number" },
    { key: "objective", label: "هدف الزيارة" },
    { key: "status", label: "حالة الخطة", options: ["planned", "completed", "cancelled"] },
  ],
  event: [
    { key: "companyId", label: "الشركة", type: "company", required: true },
    {
      key: "channel",
      label: "نوع التواصل",
      options: ["ملاحظة", "تليفون", "واتساب", "بريد إلكتروني"],
    },
    {
      key: "text",
      label: "تفاصيل التواصل / ما تم الاتفاق عليه",
      type: "textarea",
      required: true,
      wide: true,
    },
  ],
};
export const detailedVisit: Field[] = [
  { key: "objective", label: "هدف الزيارة" },
  { key: "supplier", label: "المورد الحالي — لو أفصح عنه العميل" },
  { key: "needs", label: "احتياجات العميل ومشكلاته", type: "textarea" },
  { key: "workflow", label: "طريقة الحجز / إصدار التذاكر حاليًا", type: "textarea" },
  { key: "volume", label: "حجم الشغل التقريبي — لو معروف" },
  { key: "value", label: "قيمة الفرصة التقريبية (جنيه)", type: "number" },
  { key: "objections", label: "الاعتراضات والمخاوف", type: "textarea" },
  { key: "competitors", label: "معلومات المنافسين — من مصادر مشروعة", type: "textarea" },
  { key: "feedback", label: "رأي العميل", type: "textarea" },
  { key: "opportunity", label: "الفرصة التي تم تحديدها", type: "textarea" },
  { key: "ourPromise", label: "ما وعدت به العميل", type: "textarea" },
  { key: "clientPromise", label: "ما وعد به العميل", type: "textarea" },
];
export const labels: Record<string, string> = {
  pending: "لسه مفتوحة",
  done: "مكتملة",
  planned: "مخطط لها",
  completed: "تمت",
  cancelled: "ملغاة",
};
