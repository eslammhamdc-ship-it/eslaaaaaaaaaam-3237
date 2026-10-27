export const statuses = [
  "new",
  "progress",
  "waiting",
  "completed",
  "cancelled",
  "refunded",
] as const;
export type Status = (typeof statuses)[number];
export const statusNames: Record<Status, string> = {
  new: "جديد",
  progress: "قيد التنفيذ",
  waiting: "بانتظار المعلومات",
  completed: "صادر / مكتمل",
  cancelled: "ملغي",
  refunded: "مسترد",
};
export const services = ["flight", "change", "refund", "visa", "umrah", "other"] as const;
export type Service = (typeof services)[number];
export const serviceNames: Record<Service, string> = {
  flight: "تذكرة طيران",
  change: "تعديل تذكرة",
  refund: "استرداد",
  visa: "تأشيرة",
  umrah: "عمرة",
  other: "خدمة أخرى",
};
export interface Employee {
  id: string;
  name: string;
  code: string;
  role: string;
  active: boolean;
  initials: string;
  color: string;
}
export interface Company {
  id: string;
  name: string;
  contact: string;
  details: string;
  notes: string;
  active: boolean;
}
export interface History {
  id: string;
  status: Status;
  time: string;
  actor: string;
  note: string;
}
export interface Attachment {
  id: string;
  requestId: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  createdAt: string;
}
export interface RequestRecord {
  id: string;
  ref: string;
  createdAt: string;
  companyId: string;
  employeeId: string;
  service: Service;
  traveler: string;
  origin: string;
  destination: string;
  airline: string;
  pnr: string;
  travelDate: string;
  amount: number | null;
  currency: string;
  commission: number | null;
  status: Status;
  notes: string;
  attachmentIds: string[];
  history: History[];
}
export interface OperationsData {
  employees: Employee[];
  companies: Company[];
  requests: RequestRecord[];
}
export interface Filters {
  from: string;
  to: string;
  employee: string;
  company: string;
  service: string;
  status: string;
  search: string;
}
export const emptyFilters: Filters = {
  from: "2026-10-01",
  to: "2026-10-18",
  employee: "",
  company: "",
  service: "",
  status: "",
  search: "",
};
export const isPending = (r: RequestRecord) => ["new", "progress", "waiting"].includes(r.status);
export const isIssued = (r: RequestRecord) => r.status === "completed" && r.service === "flight";
export function filterRequests(data: OperationsData, f: Filters, employeeId?: string) {
  return data.requests
    .filter((r) => {
      const day = r.createdAt.slice(0, 10);
      const c = data.companies.find((c) => c.id === r.companyId);
      const e = data.employees.find((e) => e.id === r.employeeId);
      const query = f.search.trim().toLocaleLowerCase();
      return (
        (!f.from || day >= f.from) &&
        (!f.to || day <= f.to) &&
        (!employeeId || r.employeeId === employeeId) &&
        (!f.employee || r.employeeId === f.employee) &&
        (!f.company || r.companyId === f.company) &&
        (!f.service || r.service === f.service) &&
        (!f.status || r.status === f.status) &&
        (!query ||
          `${r.ref} ${c?.name} ${e?.name} ${r.airline} ${r.pnr} ${r.origin} ${r.destination} ${serviceNames[r.service]}`
            .toLocaleLowerCase()
            .includes(query))
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function metrics(rows: RequestRecord[]) {
  return {
    total: rows.length,
    completed: rows.filter((r) => r.status === "completed").length,
    issued: rows.filter(isIssued).length,
    pending: rows.filter(isPending).length,
    closed: rows.filter((r) => r.status === "cancelled" || r.status === "refunded").length,
    waiting: rows.filter((r) => r.status === "waiting").length,
    companies: new Set(rows.map((r) => r.companyId)).size,
  };
}
export function finances(rows: RequestRecord[]) {
  return ["EGP", "USD", "SAR", "EUR"]
    .map((currency) => {
      const completed = rows.filter((r) => r.status === "completed" && r.currency === currency);
      return {
        currency,
        amount: completed.reduce((n, r) => n + (r.amount ?? 0), 0),
        commission: completed.reduce((n, r) => n + (r.commission ?? 0), 0),
        recorded: completed.filter((r) => r.amount !== null).length,
        commissionRecorded: completed.filter((r) => r.commission !== null).length,
      };
    })
    .filter((r) => r.recorded || r.commissionRecorded);
}
export function volume(rows: RequestRecord[], from: string, to: string) {
  const start = new Date(
    (from || rows.at(-1)?.createdAt.slice(0, 10) || "2026-10-01") + "T00:00:00Z",
  );
  const end = new Date((to || new Date().toISOString().slice(0, 10)) + "T00:00:00Z");
  const days = Math.floor((+end - +start) / 86400000) + 1;
  const weekly = days > 35;
  const bins: Array<{ day: string; total: number; completed: number }> = [];
  for (let i = 0; i < Math.min(days, 3660); i += weekly ? 7 : 1) {
    let d = new Date(+start + i * 86400000).toISOString().slice(0, 10);
    bins.push({ day: d, total: 0, completed: 0 });
  }
  for (const r of rows) {
    const i = Math.floor(
      (+new Date(r.createdAt.slice(0, 10) + "T00:00:00Z") - +start) / 86400000 / (weekly ? 7 : 1),
    );
    if (bins[i]) {
      bins[i].total++;
      if (r.status === "completed") bins[i].completed++;
    }
  }
  return { bins, weekly };
}
export const num = (n: number) => n.toLocaleString("en-US");
export const date = (s: string, withTime = false) =>
  new Date(s).toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
export function exportCsv(data: OperationsData, rows: RequestRecord[]) {
  const headers = [
    "Reference",
    "Created",
    "Company",
    "Employee",
    "Service",
    "Status",
    "Origin",
    "Destination",
    "Airline",
    "Currency",
    "Amount",
    "Commission",
  ];
  const cells = rows.map((r) => [
    r.ref,
    r.createdAt,
    data.companies.find((c) => c.id === r.companyId)?.name,
    data.employees.find((e) => e.id === r.employeeId)?.name,
    serviceNames[r.service],
    statusNames[r.status],
    r.origin,
    r.destination,
    r.airline,
    r.currency,
    r.amount ?? "",
    r.commission ?? "",
  ]);
  const safe = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    ["﻿" + [headers, ...cells].map((row) => row.map(safe).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "midway-operations.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function seed(): OperationsData {
  const employees: Employee[] = [
    {
      id: "e1",
      name: "أحمد منصور",
      code: "MW-001",
      role: "موظف حجوزات",
      active: true,
      initials: "أ م",
      color: "blue",
    },
    {
      id: "e2",
      name: "سارة عادل",
      code: "MW-002",
      role: "موظفة حجوزات",
      active: true,
      initials: "س ع",
      color: "purple",
    },
    {
      id: "e3",
      name: "عمر نبيل",
      code: "MW-003",
      role: "موظف حجوزات",
      active: true,
      initials: "ع ن",
      color: "orange",
    },
    {
      id: "e4",
      name: "نور حسن",
      code: "MW-004",
      role: "موظفة حجوزات",
      active: true,
      initials: "ن ح",
      color: "green",
    },
  ];
  const companies: Company[] = [
    ["c1", "آفاق للتطوير العقاري", "خالد شريف"],
    ["c2", "النيل للصناعات الحديثة", "مريم سامي"],
    ["c3", "أوريون للتكنولوجيا", "كريم هاني"],
    ["c4", "مدار للاستشارات", "دينا عاصم"],
    ["c5", "دلتا للخدمات اللوجستية", "يوسف عادل"],
    ["c6", "رؤية للتجارة الدولية", "هبة عمر"],
  ].map(([id, name, contact]) => ({
    id: id!,
    name: name!,
    contact: contact!,
    details: "demo@example.invalid",
    notes: "شركة خيالية لأغراض العرض فقط",
    active: true,
  }));
  const routes = [
    ["CAI", "DXB", "Emirates"],
    ["CAI", "JED", "EgyptAir"],
    ["CAI", "RUH", "Saudia"],
    ["CAI", "DOH", "Qatar Airways"],
    ["CAI", "LHR", "EgyptAir"],
    ["CAI", "AUH", "Etihad"],
  ];
  const requests: RequestRecord[] = [];
  for (let day = 1; day <= 18; day++) {
    const count = [4, 6, 5, 8, 4, 7, 3, 6, 8, 5, 7, 9, 4, 6, 8, 5, 7, 8][day - 1]!;
    for (let j = 0; j < count; j++) {
      const i = requests.length;
      const service = services[[0, 0, 0, 1, 0, 3, 0, 2, 4, 0, 5, 0][i % 12]!]!;
      const status: Status =
        day >= 16
          ? (
              [
                "progress",
                "completed",
                "new",
                "waiting",
                "completed",
                "cancelled",
                "completed",
                "refunded",
              ] as Status[]
            )[(i + j) % 8]!
          : i % 17 === 0
            ? "cancelled"
            : service === "refund"
              ? "refunded"
              : i % 11 === 0
                ? "waiting"
                : i % 9 === 0
                  ? "progress"
                  : "completed";
      const [origin, destination, airline] = routes[i % 6]!;
      const createdAt = `2026-10-${String(day).padStart(2, "0")}T${String(8 + j).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00+02:00`;
      const id = `demo-${i + 1}`;
      requests.push({
        id,
        ref: `MW-26-${String(1001 + i)}`,
        createdAt,
        companyId: companies[(i + Math.floor(i / 5)) % 6]!.id,
        employeeId: employees[(i + Math.floor(i / 7)) % 4]!.id,
        service,
        traveler: `DEMO-${String(i + 1).padStart(3, "0")}`,
        origin: ["flight", "change", "refund"].includes(service) ? origin! : "",
        destination: ["flight", "change", "refund"].includes(service) ? destination! : "",
        airline: ["flight", "change", "refund"].includes(service) ? airline! : "",
        pnr: ["flight", "change", "refund"].includes(service)
          ? `DEMO${String(i).padStart(2, "0")}`
          : "",
        travelDate: `2026-11-${String((i % 27) + 1).padStart(2, "0")}`,
        amount:
          i % 7 === 0 ? null : service === "flight" ? 8200 + (i % 9) * 950 : 2400 + (i % 5) * 400,
        currency: "EGP",
        commission: i % 7 === 0 ? null : 250 + (i % 5) * 75,
        status,
        notes:
          status === "waiting"
            ? "في انتظار تأكيد البيانات من الشركة. بيانات تجريبية."
            : "طلب تجريبي مسجل يدويًا — لا يمثل حجزًا حقيقيًا.",
        attachmentIds: [],
        history: [
          {
            id: `h-${id}`,
            status: "new",
            time: createdAt,
            actor: employees[(i + Math.floor(i / 7)) % 4]!.name,
            note: "إنشاء الطلب (بيانات تجريبية)",
          },
          ...(status !== "new"
            ? [
                {
                  id: `h2-${id}`,
                  status,
                  time: new Date(+new Date(createdAt) + 1800000).toISOString(),
                  actor: employees[(i + Math.floor(i / 7)) % 4]!.name,
                  note: "تحديث الحالة (بيانات تجريبية)",
                },
              ]
            : []),
        ],
      });
    }
  }
  return { employees, companies, requests };
}
let dbPromise: Promise<IDBDatabase> | undefined;
function database() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("midway-flight-operations-v1", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("state");
      req.result.createObjectStore("attachments", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("أغلق نوافذ التطبيق الأخرى وأعد المحاولة."));
  }));
}
export async function loadData(): Promise<OperationsData> {
  const db = await database();
  const result = await new Promise<OperationsData | undefined>((resolve, reject) => {
    const q = db.transaction("state").objectStore("state").get("data");
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
  if (result) return result;
  const initial = seed();
  await saveData(initial);
  return initial;
}
export async function saveData(data: OperationsData, files: Attachment[] = []) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["state", "attachments"], "readwrite");
    tx.objectStore("state").put(data, "data");
    files.forEach((f) => tx.objectStore("attachments").put(f));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("تعذر الحفظ"));
  });
}
export async function loadAttachment(id: string): Promise<Attachment | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const q = db.transaction("attachments").objectStore("attachments").get(id);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
