import { useEffect, useRef, useState } from "react";
import {
  X,
  UploadCloud,
  FileText,
  Paperclip,
  Download,
  Clock3,
  Plane,
  Save,
  AlertCircle,
} from "lucide-react";
import {
  type OperationsData,
  type RequestRecord,
  type Attachment,
  type Company,
  type Status,
  statuses,
  statusNames,
  services,
  serviceNames,
  loadAttachment,
  date,
  num,
} from "../lib/operations";
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status-badge ${status}`}>
      <i />
      {statusNames[status]}
    </span>
  );
}
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <dialog
        open
        className={`modal ${wide ? "wide" : ""}`}
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        dir="rtl"
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>
        {children}
      </dialog>
    </div>
  );
}
const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"];
export function RequestForm({
  data,
  employeeId,
  role,
  initial,
  onClose,
  onSave,
}: {
  data: OperationsData;
  employeeId: string;
  role: string;
  initial?: RequestRecord;
  onClose: () => void;
  onSave: (r: RequestRecord, files: Attachment[]) => Promise<void>;
}) {
  const [service, setService] = useState(initial?.service ?? "flight");
  const [companyId, setCompanyId] = useState(initial?.companyId ?? "");
  const [companyQuery, setCompanyQuery] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setFileUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  const flight = ["flight", "change", "refund"].includes(service);
  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const incoming = Array.from(newFiles);
    if (incoming.some((f) => !allowed.includes(f.type))) {
      setError("الملفات المدعومة: JPG، PNG، WebP، PDF أو TXT.");
      return;
    }
    if (
      incoming.some((f) => f.size > 5 * 1024 * 1024) ||
      incoming.reduce((n, f) => n + f.size, 0) + files.reduce((n, f) => n + f.size, 0) >
        20 * 1024 * 1024
    ) {
      setError("الحد الأقصى 5 MB للملف و20 MB للمرفقات الجديدة.");
      return;
    }
    setFiles([...files, ...incoming]);
    setError("");
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) {
      setError("اختر شركة العميل من القائمة.");
      return;
    }
    const values = new FormData(e.currentTarget);
    const get = (k: string) => String(values.get(k) ?? "").trim();
    const money = (k: string) => (get(k) === "" ? null : Number(get(k)));
    if (
      [money("amount"), money("commission")].some(
        (n) => n !== null && (!Number.isFinite(n) || n < 0),
      )
    ) {
      setError("أدخل مبالغ صحيحة غير سالبة.");
      return;
    }
    const id = initial?.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const actor =
      role === "manager"
        ? "مدير الطيران"
        : (data.employees.find((e) => e.id === employeeId)?.name ?? "موظف");
    const status = get("status") as Status;
    const attachments: Attachment[] = files.map((f) => ({
      id: crypto.randomUUID(),
      requestId: id,
      name: f.name,
      type: f.type,
      size: f.size,
      blob: f,
      createdAt: now,
    }));
    const record: RequestRecord = {
      id,
      ref: initial?.ref ?? `MW-26-${id.slice(0, 8).toUpperCase()}`,
      createdAt: initial?.createdAt ?? now,
      companyId,
      employeeId: role === "employee" ? employeeId : get("employeeId"),
      service,
      traveler: get("traveler"),
      origin: flight ? get("origin").toUpperCase() : "",
      destination: flight ? get("destination").toUpperCase() : "",
      airline: flight ? get("airline") : "",
      pnr: flight ? get("pnr").toUpperCase() : "",
      travelDate: get("travelDate"),
      amount: money("amount"),
      currency: get("currency"),
      commission: money("commission"),
      status,
      notes: get("notes"),
      attachmentIds: [...(initial?.attachmentIds ?? []), ...attachments.map((a) => a.id)],
      history: [
        ...(initial?.history ?? []),
        {
          id: crypto.randomUUID(),
          status,
          time: now,
          actor,
          note: initial
            ? initial.status === status
              ? "تحديث بيانات الطلب"
              : "تحديث البيانات والحالة"
            : "إنشاء الطلب يدويًا",
        },
      ],
    };
    setSaving(true);
    setError("");
    try {
      await onSave(record, attachments);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الطلب");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={initial ? "تعديل الطلب" : "تسجيل طلب جديد"}
      subtitle="التسجيل اليدوي هو مصدر البيانات • جميع الحقول الاختيارية موضحة"
      onClose={() => !saving && onClose()}
      wide
    >
      <form onSubmit={submit}>
        <div className="form-body">
          <div className="form-info">
            <Plane size={17} />
            <span>
              {initial ? (
                <b dir="ltr">{initial.ref}</b>
              ) : (
                "يُنشأ مرجع فريد وتاريخ التسجيل تلقائيًا عند الحفظ"
              )}
            </span>
          </div>
          <h4>بيانات العملية</h4>
          <div className="form-grid">
            <label className="company-field">
              شركة العميل <span className="required">*</span>
              <input
                value={companyQuery}
                onChange={(e) => setCompanyQuery(e.target.value)}
                placeholder="ابحث باسم الشركة…"
                aria-label="البحث عن شركة في النموذج"
              />
              <select
                required
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                aria-label="شركة العميل"
              >
                <option value="">اختر الشركة</option>
                {data.companies
                  .filter(
                    (c) =>
                      (c.active || c.id === initial?.companyId) &&
                      (!companyQuery || c.name.includes(companyQuery)),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              الموظف المسؤول <span className="required">*</span>
              <select
                name="employeeId"
                required
                defaultValue={initial?.employeeId ?? employeeId}
                disabled={role === "employee"}
              >
                {data.employees
                  .filter((e) => e.active || e.id === initial?.employeeId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              نوع الخدمة <span className="required">*</span>
              <select
                value={service}
                onChange={(e) => setService(e.target.value as typeof service)}
              >
                {services.map((s) => (
                  <option key={s} value={s}>
                    {serviceNames[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              الحالة <span className="required">*</span>
              <select name="status" defaultValue={initial?.status ?? "new"}>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {statusNames[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              مرجع المسافر <small>اختياري — لا تستخدم بيانات حقيقية</small>
              <input
                aria-label="مرجع المسافر"
                name="traveler"
                defaultValue={initial?.traveler}
                placeholder="DEMO-001"
                maxLength={80}
              />
            </label>
            <label>
              تاريخ السفر <small>اختياري</small>
              <input
                aria-label="تاريخ السفر"
                type="date"
                name="travelDate"
                defaultValue={initial?.travelDate}
              />
            </label>
          </div>
          {flight && (
            <>
              <h4>
                تفاصيل الرحلة <small>اختياري</small>
              </h4>
              <div className="form-grid">
                <label>
                  من
                  <input
                    aria-label="نقطة المغادرة"
                    name="origin"
                    defaultValue={initial?.origin}
                    placeholder="CAI — القاهرة"
                    maxLength={60}
                  />
                </label>
                <label>
                  إلى
                  <input
                    aria-label="نقطة الوصول"
                    name="destination"
                    defaultValue={initial?.destination}
                    placeholder="DXB — دبي"
                    maxLength={60}
                  />
                </label>
                <label>
                  شركة الطيران
                  <input
                    aria-label="شركة الطيران"
                    name="airline"
                    defaultValue={initial?.airline}
                    placeholder="مثال: EgyptAir"
                    maxLength={80}
                  />
                </label>
                <label>
                  مرجع الحجز / PNR
                  <input
                    aria-label="مرجع الحجز"
                    name="pnr"
                    defaultValue={initial?.pnr}
                    placeholder="مرجع الحجز"
                    maxLength={24}
                  />
                </label>
              </div>
            </>
          )}
          <h4>
            البيانات المالية <small>اختياري — لا تدخل صفرًا بدل البيانات غير المتاحة</small>
          </h4>
          <div className="form-grid three">
            <label>
              قيمة التذكرة / الخدمة
              <input
                aria-label="قيمة التذكرة أو الخدمة"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initial?.amount ?? ""}
                placeholder="غير مسجل"
              />
            </label>
            <label>
              العملة
              <select name="currency" defaultValue={initial?.currency ?? "EGP"}>
                {["EGP", "USD", "SAR", "EUR"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              العمولة / الإيراد
              <input
                aria-label="العمولة أو الإيراد"
                name="commission"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initial?.commission ?? ""}
                placeholder="غير مسجل"
              />
            </label>
          </div>
          <label>
            ملاحظات <small>اختياري</small>
            <textarea
              aria-label="ملاحظات"
              name="notes"
              defaultValue={initial?.notes}
              placeholder="تفاصيل مختصرة تساعد الفريق على متابعة الطلب…"
              maxLength={2000}
              rows={2}
            />
          </label>
          <h4>التذكرة والمستندات</h4>
          {initial?.attachmentIds.length ? (
            <p className="muted">
              {initial.attachmentIds.length} مرفق محفوظ؛ الملفات الجديدة ستُضاف دون حذف القديم.
            </p>
          ) : null}
          <label className="upload-area">
            <UploadCloud size={26} />
            <strong>اختر مستندًا أو اسحبه هنا</strong>
            <span>PNG، JPG، WebP، PDF، TXT • حتى 5 MB للملف</span>
            <input
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.pdf,.txt"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              aria-label="إرفاق مستند"
            />
          </label>
          {files.length > 0 && (
            <div className="file-list">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`}>
                  {f.type.startsWith("image/") ? (
                    <img src={fileUrls[i]} alt="معاينة المرفق" />
                  ) : (
                    <FileText size={22} />
                  )}
                  <span>
                    {f.name}
                    <small>{(f.size / 1024).toFixed(0)} KB</small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setFiles(files.filter((_, j) => i !== j))}
                    aria-label={`إزالة ${f.name}`}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="storage-note">
            <AlertCircle size={14} />
            المرفقات محفوظة على خادم الفرع، ويمكن للمستخدمين المصرح لهم الاطلاع عليها.
          </p>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <span className="muted">تسجيل داخلي • دون إصدار تذكرة لدى شركة الطيران</span>
          <button type="button" className="button secondary" disabled={saving} onClick={onClose}>
            إلغاء
          </button>
          <button className="button primary" disabled={saving}>
            <Save size={16} />
            {saving ? "جارٍ الحفظ…" : initial ? "حفظ التعديلات" : "تسجيل الطلب"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function AttachmentView({ id }: { id: string }) {
  const [file, setFile] = useState<Attachment>();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    loadAttachment(id)
      .then(async (f) => {
        if (!active) return;
        if (!f) {
          setError("هذا الملف غير متاح أو لم يعد لديك صلاحية عرضه.");
          return;
        }
        setFile(f);
        objectUrl = URL.createObjectURL(f.blob);
        setUrl(objectUrl);
        if (f.type === "text/plain") setText(await f.blob.text());
      })
      .catch(() => active && setError("تعذر قراءة المرفق."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (loading) return <p className="muted">جارٍ تحميل المرفق…</p>;
  if (error) return <div className="error">{error}</div>;
  if (!file) return null;
  return (
    <div className="attachment-preview">
      <div className="attachment-heading">
        <Paperclip size={17} />
        <span>
          {file.name}
          <small>{(file.size / 1024).toFixed(0)} KB • محفوظ في الفرع</small>
        </span>
        <a
          className="icon-button"
          href={url}
          download={file.name}
          aria-label={`تنزيل ${file.name}`}
        >
          <Download size={17} />
        </a>
      </div>
      {file.type.startsWith("image/") ? (
        <img src={url} alt={`مرفق ${file.name}`} />
      ) : file.type === "application/pdf" ? (
        <object data={url} type="application/pdf" aria-label={file.name}>
          <p>معاينة PDF غير متاحة. استخدم زر التنزيل.</p>
        </object>
      ) : (
        <pre>{text.slice(0, 20000)}</pre>
      )}
    </div>
  );
}
export function RequestDetail({
  record,
  data,
  canEdit,
  onClose,
  onEdit,
  onStatus,
}: {
  record: RequestRecord;
  data: OperationsData;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onStatus: (status: Status) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const employee = data.employees.find((e) => e.id === record.employeeId);
  const company = data.companies.find((c) => c.id === record.companyId);
  async function change(s: Status) {
    setSaving(true);
    setError("");
    try {
      await onStatus(s);
    } catch {
      setError("تعذر حفظ الحالة. أعد المحاولة.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title="تفاصيل الطلب" subtitle={record.ref} onClose={() => !saving && onClose()} wide>
      <div className="form-body">
        <div className="detail-top">
          <span className="detail-service">
            <Plane size={24} />
            {serviceNames[record.service]}
          </span>
          <StatusBadge status={record.status} />
        </div>
        <div className="detail-grid">
          {[
            ["الشركة", company?.name],
            ["الموظف المسؤول", employee?.name],
            ["تاريخ التسجيل", date(record.createdAt, true)],
            ["تاريخ السفر", record.travelDate ? date(record.travelDate) : "غير مسجل"],
            [
              "مسار الرحلة",
              record.origin && record.destination
                ? `${record.origin} → ${record.destination}`
                : "غير مسجل",
            ],
            ["شركة الطيران", record.airline || "غير مسجل"],
            ["مرجع المسافر", record.traveler || "غير مسجل"],
            ["مرجع الحجز", record.pnr || "غير مسجل"],
            [
              "قيمة الخدمة",
              record.amount === null ? "غير مسجل" : `${num(record.amount)} ${record.currency}`,
            ],
            [
              "العمولة / الإيراد",
              record.commission === null
                ? "غير مسجل"
                : `${num(record.commission)} ${record.currency}`,
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <h4>الملاحظات</h4>
        <p className="note-box">{record.notes || "لا توجد ملاحظات إضافية."}</p>
        {canEdit && (
          <div className="status-control">
            <label>
              تحديث حالة الطلب
              <select
                value={record.status}
                disabled={saving}
                onChange={(e) => change(e.target.value as Status)}
                aria-label="تحديث حالة الطلب"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {statusNames[s]}
                  </option>
                ))}
              </select>
            </label>
            <p>كل تغيير يُسجَّل باسم المستخدم الفعلي وتوقيته.</p>
          </div>
        )}
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <h4>
          المرفقات <span className="count-tag">{record.attachmentIds.length}</span>
        </h4>
        {record.attachmentIds.length ? (
          record.attachmentIds.map((id) => <AttachmentView key={id} id={id} />)
        ) : (
          <div className="attachment-empty">
            <FileText size={24} />
            <p>لا توجد مستندات مرفقة لهذا الطلب</p>
            {canEdit && (
              <button className="text-button" onClick={onEdit}>
                إضافة مرفق من تعديل الطلب
              </button>
            )}
          </div>
        )}
        <p className="storage-note">
          <AlertCircle size={14} />
          الوصول للمرفقات محمي بصلاحيات الحساب على الخادم.
        </p>
        <h4>
          <Clock3 size={15} /> سجل النشاط
        </h4>
        <div className="timeline">
          {[...record.history].reverse().map((h) => (
            <div key={h.id}>
              <i />
              <div>
                <strong>{h.note}</strong>
                <StatusBadge status={h.status} />
                <p>
                  {h.actor} <span>• {date(h.time, true)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose} disabled={saving}>
          إغلاق
        </button>
        {canEdit && (
          <button className="button primary" onClick={onEdit} disabled={saving}>
            تعديل الطلب
          </button>
        )}
      </div>
    </Modal>
  );
}
export function CompanyForm({
  initial,
  data,
  onClose,
  onSave,
}: {
  initial?: Company;
  data: OperationsData;
  onClose: () => void;
  onSave: (c: Company) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    if (!name) {
      setError("اسم الشركة مطلوب.");
      return;
    }
    if (data.companies.some((c) => c.id !== initial?.id && normalize(c.name) === normalize(name))) {
      setError("توجد شركة بهذا الاسم بالفعل.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial?.id ?? crypto.randomUUID(),
        name,
        contact: String(f.get("contact") ?? "").trim(),
        details: String(f.get("details") ?? "").trim(),
        notes: String(f.get("notes") ?? "").trim(),
        active: f.get("active") === "true",
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الشركة");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={initial ? "تعديل شركة العميل" : "إضافة شركة جديدة"}
      subtitle="شركة مشتركة بين العمليات وإدارة العملاء"
      onClose={() => !saving && onClose()}
    >
      <form onSubmit={submit}>
        <div className="form-body form-stack">
          <label>
            اسم الشركة <span className="required">*</span>
            <input
              aria-label="اسم الشركة"
              required
              name="name"
              defaultValue={initial?.name}
              maxLength={120}
            />
          </label>
          <label>
            مسؤول التواصل <small>اختياري</small>
            <input
              aria-label="مسؤول التواصل"
              name="contact"
              defaultValue={initial?.contact}
              maxLength={100}
            />
          </label>
          <label>
            بيانات التواصل <small>اختياري</small>
            <input
              aria-label="بيانات التواصل"
              name="details"
              defaultValue={initial?.details}
              maxLength={180}
            />
          </label>
          <label>
            الحالة
            <select name="active" defaultValue={String(initial?.active ?? true)}>
              <option value="true">نشطة</option>
              <option value="false">غير نشطة</option>
            </select>
          </label>
          <label>
            ملاحظات
            <textarea
              aria-label="ملاحظات"
              name="notes"
              defaultValue={initial?.notes}
              maxLength={1000}
              rows={3}
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose} disabled={saving}>
            إلغاء
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? "جارٍ الحفظ…" : "حفظ الشركة"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
