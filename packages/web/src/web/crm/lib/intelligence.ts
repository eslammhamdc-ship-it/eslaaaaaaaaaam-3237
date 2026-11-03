import { dateKey, dueState, stages, statuses, today, type Row } from "./crm";
export type Point = { lat: number; lng: number };
export function point(c: Row): Point | null {
  const lat = c.data.latitude,
    lng = c.data.longitude;
  if (lat === "" || lng === "" || lat == null || lng == null) return null;
  const a = Number(lat),
    b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180
    ? { lat: a, lng: b }
    : null;
}
export function distance(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export const priorityScore = (c: Row) =>
  c.data.priority === "A" ? 3 : c.data.priority === "C" ? 1 : 2;
export const areaName = (c: Row) =>
  [c.data.neighborhood, c.data.city, c.data.governorate].filter(Boolean).join(" · ") ||
  "منطقة غير مسجلة";
export function areaGroups(companies: Row[], opportunities: Row[]) {
  const groups = new Map<
    string,
    { name: string; companies: Row[]; open: number; priority: number }
  >();
  for (const c of companies) {
    const name = areaName(c);
    if (!groups.has(name)) groups.set(name, { name, companies: [], open: 0, priority: 0 });
    const g = groups.get(name)!;
    g.companies.push(c);
    g.priority += c.data.priority === "A" ? 1 : 0;
    g.open += opportunities.filter(
      (o) => o.companyId === c.id && ![stages[6], stages[7]].includes(o.data.stage),
    ).length;
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.priority * 2 +
      b.open * 2 +
      b.companies.length -
      (a.priority * 2 + a.open * 2 + a.companies.length),
  );
}
// Connected proximity groups, not an assertion about unrecorded businesses.
export function clusters(companies: Row[], radius = 1) {
  const remaining = companies.filter((c) => point(c));
  const out: Row[][] = [];
  while (remaining.length) {
    const group = [remaining.shift()!];
    for (let i = 0; i < group.length; i++)
      for (let j = remaining.length - 1; j >= 0; j--)
        if (distance(point(group[i])!, point(remaining[j])!) <= radius)
          group.push(...remaining.splice(j, 1));
    out.push(group);
  }
  return out.sort((a, b) => b.length - a.length);
}
export function routeOrder(companies: Row[], start?: Point) {
  const located = companies.filter((c) => point(c));
  const unknown = companies
    .filter((c) => !point(c))
    .sort(
      (a, b) => priorityScore(b) - priorityScore(a) || areaName(a).localeCompare(areaName(b), "ar"),
    );
  const order: Row[] = [];
  let current = start;
  while (located.length) {
    located.sort((a, b) =>
      current
        ? distance(current, point(a)!) / (1 + 0.2 * priorityScore(a)) -
          distance(current, point(b)!) / (1 + 0.2 * priorityScore(b))
        : priorityScore(b) - priorityScore(a) || areaName(a).localeCompare(areaName(b), "ar"),
    );
    const c = located.shift()!;
    order.push(c);
    current = point(c)!;
  }
  return [...order, ...unknown];
}
export function routeKm(companies: Row[]) {
  let km = 0;
  for (let i = 1; i < companies.length; i++) {
    const a = point(companies[i - 1]),
      b = point(companies[i]);
    if (a && b) km += distance(a, b);
  }
  return km;
}
export function proposeFollowup(outcome: string) {
  const rules: Record<string, { action: string; days: number }> = {
    "طلب عرض سعر": { action: "إرسال عرض السعر ومراجعة تفاصيل احتياج العميل", days: 1 },
    "تم الاتفاق على تجربة": { action: "تأكيد خطوات التجربة ومراجعة أول حجز", days: 2 },
    "مهتم بالخدمات": { action: "إرسال معلومات الخدمات المناسبة والتأكد من وصولها", days: 2 },
    "محتاج متابعة": { action: "التواصل لاستكمال النقاط المتفق عليها", days: 3 },
    "غير مهتم حاليًا": { action: "استئذان العميل في تواصل لاحق مناسب", days: 14 },
    "حل مشكلة": { action: "التأكد من رضا العميل بعد حل المشكلة", days: 2 },
    "لم تتم المقابلة": { action: "تحديد موعد مناسب مع الشخص المسؤول", days: 1 },
  };
  return rules[outcome] || { action: "مراجعة الخطوة التالية مع العميل", days: 3 };
}
export function suggestedDate(base: string, days: number) {
  const d = new Date(base && Number.isFinite(Date.parse(base)) ? base : Date.now());
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function linkedVisits(visits: Row[], opportunities: Row[]) {
  return visits.filter((v) =>
    opportunities.some((o) => o.data.visitId === v.id && o.companyId === v.companyId),
  );
}
export function decisions(rows: Row[]) {
  const cs = rows.filter((r) => r.kind === "company"),
    ts = rows.filter((r) => r.kind === "followup"),
    os = rows.filter((r) => r.kind === "opportunity");
  const get = (id: string | null) => cs.find((c) => c.id === id)?.data.name || "";
  const list: { title: string; reason: string; kind: string; companyId?: string; row?: Row }[] = [];
  for (const t of ts
    .filter((t) => ["overdue", "today"].includes(dueState(t)))
    .sort((a, b) => (a.data.due || "").localeCompare(b.data.due || ""))
    .slice(0, 3))
    list.push({
      title: `تابع ${get(t.companyId)}`,
      reason: `${dueState(t) === "overdue" ? "موعد متأخر" : "موعد اليوم"}: ${t.data.action}`,
      kind: "followup",
      row: t,
    });
  for (const o of os
    .filter(
      (o) =>
        ![stages[6], stages[7]].includes(o.data.stage) &&
        (o.data.obstacle || (o.data.expectedClose && dateKey(o.data.expectedClose) <= today())),
    )
    .slice(0, 2))
    list.push({
      title: `راجع فرصة ${get(o.companyId)}`,
      reason: o.data.obstacle ? `عائق مسجل: ${o.data.obstacle}` : "موعد الإغلاق المتوقع وصل أو فات",
      kind: "opportunity",
      row: o,
    });
  const groups = areaGroups(cs, os).filter((g) => g.name !== "منطقة غير مسجلة");
  if (groups[0])
    list.push({
      title: `خطط زيارة ${groups[0].name}`,
      reason: `${groups[0].companies.length} شركة مسجلة، ${groups[0].priority} أولوية A، ${groups[0].open} فرصة مفتوحة`,
      kind: "plan",
    });
  for (const c of cs
    .filter(
      (c) =>
        c.data.status === statuses[2] ||
        (c.data.priority === "A" &&
          !ts.some((t) => t.companyId === c.id && t.data.status !== "done")),
    )
    .slice(0, 2))
    list.push({
      title: `${c.data.status === statuses[2] ? "أعد تنشيط" : "حدد خطوة لـ"} ${c.data.name}`,
      reason:
        c.data.status === statuses[2]
          ? "تصنيف الشركة المسجل: عميل غير نشط"
          : "أولوية A بدون متابعة مفتوحة",
      kind: "followup",
      companyId: c.id,
    });
  return list.slice(0, 6);
}
