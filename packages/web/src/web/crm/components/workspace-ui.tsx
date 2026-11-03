import { ClipboardList, Plus } from "lucide-react";
export function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function Empty({
  title = "مفيش سجلات لسه",
  text = "ابدأ بإضافة أول سجل، وهيظهر هنا.",
  action,
  onClick,
}: {
  title?: string;
  text?: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <ClipboardList size={28} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="primary" onClick={onClick}>
          <Plus size={17} />
          {action}
        </button>
      )}
    </div>
  );
}
