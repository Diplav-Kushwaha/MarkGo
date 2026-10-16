import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * Light-theme UI primitives for the Super Admin console.
 *
 * These mirror the Super Admin login page exactly: slate-100 page, white
 * rounded-2xl cards with a soft shadow, slate-900 headings, slate-500 helper
 * text and blue-800 as the primary. Super Admin only — no shared component was
 * modified to create this file.
 */

export function SACard({ className, children, ...props }) {
  return (
    <div
      className={cn("rounded-card border border-primary-100/70 bg-white/95 shadow-card", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SACardHeader({ title, subtitle, actions, className }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-primary-100 px-5 py-4",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  primary: "bg-primary-50 text-primary-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-600",
};

export function SATone({ tone = "slate", icon: Icon, children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold",
        TONES[tone] || TONES.slate,
        className
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Company status badge, driven by the real CompanyStatus values. */
const STATUS_STYLES = {
  ACTIVE: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Active", dot: "bg-emerald-500" },
  SUSPENDED: { chip: "bg-amber-50 text-amber-700 ring-amber-200", label: "Suspended", dot: "bg-amber-500" },
  CANCELLED: { chip: "bg-slate-100 text-slate-600 ring-slate-200", label: "Cancelled", dot: "bg-slate-400" },
  PENDING: { chip: "bg-blue-50 text-blue-700 ring-blue-200", label: "Pending", dot: "bg-blue-500" },
  PAID: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Paid", dot: "bg-emerald-500" },
  FAILED: { chip: "bg-red-50 text-red-700 ring-red-200", label: "Failed", dot: "bg-red-500" },
};

export function SAStatusBadge({ status, className }) {
  const key = status || "ACTIVE";
  const style = STATUS_STYLES[key] || STATUS_STYLES.ACTIVE;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        style.chip,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden="true" />
      {style.label}
    </span>
  );
}

const BUTTON_VARIANTS = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-control bg-[#111A3A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1B2550] focus:outline-none focus:ring-4 focus:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-control border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-primary-700 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-2 text-sm font-semibold text-body transition-colors hover:bg-primary-50 hover:text-ink focus:outline-none focus:ring-4 focus:ring-primary-100",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-control border border-danger-line bg-white px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft focus:outline-none focus:ring-4 focus:ring-danger-line",
};

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "",
};

export function SAButton({
  variant = "secondary",
  size = "md",
  loading = false,
  icon: Icon,
  className,
  children,
  type = "button",
  disabled,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.secondary,
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

const CONTROL =
  "h-11 w-full rounded-control border border-line bg-white px-3 text-sm text-ink transition-colors " +
  "placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-200";

export function SAInput({ className, label, id, hint, ...props }) {
  const input = (
    <input id={id} className={cn(CONTROL, className)} {...props} />
  );

  if (!label) return input;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {input}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function SASelect({ className, label, id, children, ...props }) {
  const select = (
    <div className="relative">
      <select id={id} className={cn(CONTROL, "cursor-pointer pr-9", className)} {...props}>
        {children}
      </select>
    </div>
  );

  if (!label) return select;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {select}
    </div>
  );
}

export function SAErrorAlert({ message, onRetry, className }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start justify-between gap-3 rounded-control border border-danger-line bg-danger-soft px-4 py-3",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        <p className="text-sm text-danger">{message}</p>
      </div>
      {onRetry && (
        <SAButton
          variant="secondary"
          size="sm"
          onClick={onRetry.retry}
          className="shrink-0 border-danger-line text-danger hover:border-danger hover:text-danger"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </SAButton>
      )}
    </div>
  );
}

export function SAEmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-tile bg-primary-50 text-primary-700">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SASkeleton({ className = "" }) {
  return <div className={cn("animate-pulse rounded-control bg-primary-100", className)} />;
}

/** Grey placeholder block matching a stat card's shape. */
export function SAStatCardSkeleton() {
  return (
    <SACard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <SASkeleton className="h-3 w-24" />
        <SASkeleton className="h-10 w-10 rounded-tile" />
      </div>
      <SASkeleton className="mt-4 h-7 w-32" />
      <SASkeleton className="mt-2 h-3 w-20" />
    </SACard>
  );
}

/** Placeholder rows for the companies table. */
export function SATableSkeleton({ rows = 6, columns = 6 }) {
  return (
    <div className="divide-y divide-primary-100">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-5 py-4">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <SASkeleton
              key={colIndex}
              className={cn("h-3.5", colIndex === 0 ? "w-40" : "flex-1")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
