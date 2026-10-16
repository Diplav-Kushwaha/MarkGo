import { cn } from "../../lib/cn";

const TONES = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success-soft text-green-800",
  warning: "bg-warning-soft text-amber-800",
  danger: "bg-danger-soft text-red-700",
  info: "bg-info-soft text-blue-800",
  muted: "bg-muted-soft text-slate-700",
};

export default function StatCard({ label, value, hint, icon: Icon, tone = "primary", className, onClick }) {
  const interactive = typeof onClick === "function";

  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-card border border-line bg-white p-5 shadow-card",
        interactive && "cursor-pointer transition-shadow hover:shadow-card-hover",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {Icon && (
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-tile", TONES[tone])}>
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
