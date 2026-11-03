import { Link } from "wouter";
import { useRecords } from "../crm/queries/crm";
import type { OperationsData } from "../lib/operations";
import { useWorkspace } from "../lib/workspace";
export default function BranchOverview({ data }: { data?: OperationsData }) {
  const { user } = useWorkspace();
  const query = useRecords();
  const rows = query.data || [];
  const today = new Date().toISOString().slice(0, 10);
  const values = [
    ["شركات الفرع", data?.companies.length || 0],
    [
      "طلبات طيران قيد المتابعة",
      data?.requests.filter((r) => ["new", "progress", "waiting"].includes(r.status)).length || 0,
    ],
    ["زيارات مسجلة", rows.filter((r) => r.kind === "visit").length],
    [
      "متابعات متأخرة",
      rows.filter(
        (r) =>
          r.kind === "followup" &&
          r.data.status !== "done" &&
          r.data.due &&
          String(r.data.due).slice(0, 10) < today,
      ).length,
    ],
    ["فرص بيع مسجلة", rows.filter((r) => r.kind === "opportunity").length],
  ];
  return (
    <section className="branch-overview">
      <h2>{user.role === "branch_manager" ? "لوحة مدير الفرع" : "لوحة مدير المبيعات"}</h2>
      <p>نتائج من السجلات الفعلية للفرع · الزيارة أو فرصة البيع لا تعني إصدار تذكرة أو تحصيل مبلغ.</p>
      {query.isError ? (
        <p role="alert">
          تعذر تحميل مؤشرات العملاء.{" "}
          <button onClick={() => void query.refetch()}>إعادة المحاولة</button>
        </p>
      ) : query.isPending ? (
        <p>جارٍ تحميل المؤشرات…</p>
      ) : (
        <div className="branch-metrics">
          {values.map(([label, value]) => (
            <div key={label}>
              <strong>{Number(value).toLocaleString("ar-EG")}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="workspace-links">
        <Link href="/crm">العملاء والمتابعات والتحليلات</Link>
        <Link href="/reports">نتائج الطيران والملخص المالي</Link>
        {user.role === "branch_manager" && (
          <Link href="/team">الحسابات والصلاحيات وسجل الإجراءات</Link>
        )}
      </div>
    </section>
  );
}
