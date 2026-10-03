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
      className={cn("rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60", className)}
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
        "flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  primary: "bg-blue-50 text-blue-800",
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
    "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-800 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100",
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
  "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition-colors " +
  "placeholder:text-slate-400 focus:border-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100";

export function SAInput({ className, label, id, hint, ...props }) {
  const input = (
    <input id={id} className={cn(CONTROL, className)} {...props} />
  );

  if (!label) return input;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {input}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
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
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
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
        "flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
        <p className="text-sm text-red-600">{message}</p>
      </div>
      {onRetry && (
        <SAButton
          variant="secondary"
          size="sm"
          onClick={onRetry.retry}
          className="shrink-0 border-red-200 text-red-600 hover:border-red-400 hover:text-red-700"
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
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SASkeleton({ className = "" }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200", className)} />;
}

/** Grey placeholder block matching a stat card's shape. */
export function SAStatCardSkeleton() {
  return (
    <SACard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <SASkeleton className="h-3 w-24" />
        <SASkeleton className="h-9 w-9 rounded-xl" />
      </div>
      <SASkeleton className="mt-4 h-7 w-32" />
      <SASkeleton className="mt-2 h-3 w-20" />
    </SACard>
  );
}

/** Placeholder rows for the companies table. */
export function SATableSkeleton({ rows = 6, columns = 6 }) {
  return (
    <div className="divide-y divide-slate-100">
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
