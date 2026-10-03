import { cn } from "../../lib/cn";

/**
 * Single source of truth for status -> visual tone across the app so a badge
 * always means the same thing no matter which page renders it.
 */
const STATUS_TONES = {
  // Invoice / bill payment lifecycle
  PAID: "success",
  ACTIVE: "success",
  SENT: "warning",
  PARTIALLY_PAID: "warning",
  PENDING: "warning",
  UNPAID: "danger",
  OVERDUE: "danger",
  DRAFT: "muted",
  INACTIVE: "muted",
  CANCELLED: "muted",
  VOID: "muted",
  OPEN: "info",
  CLOSED: "muted",
};

const STATUS_LABELS = {
  PARTIALLY_PAID: "Partially Paid",
  INACTIVE: "Inactive",
  CANCELLED: "Cancelled",
};

const TONES = {
  success: "bg-success-soft text-green-700 ring-success-line",
  warning: "bg-warning-soft text-amber-700 ring-warning-line",
  danger: "bg-danger-soft text-red-700 ring-danger-line",
  info: "bg-info-soft text-sky-800 ring-info-line",
  muted: "bg-muted-soft text-slate-600 ring-muted-line",
  primary: "bg-primary-50 text-primary-700 ring-primary-200",
};

export default function StatusBadge({ status, label, tone, dot = false, className }) {
  const key = status || "";
  const resolvedTone = tone || STATUS_TONES[key] || "muted";
  const text = label || STATUS_LABELS[key] || (key ? key.replace(/_/g, " ") : "Unknown");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        TONES[resolvedTone] || TONES.muted,
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />}
      {text}
    </span>
  );
}
