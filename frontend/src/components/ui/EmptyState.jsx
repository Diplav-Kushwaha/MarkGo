import { cn } from "../../lib/cn";

export default function EmptyState({ icon: Icon, title, description, action, className, compact = false }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-6 py-10" : "px-6 py-16",
        className
      )}
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-tile bg-primary-50 text-primary-700">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
