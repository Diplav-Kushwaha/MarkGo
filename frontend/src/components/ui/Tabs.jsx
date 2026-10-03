import { cn } from "../../lib/cn";

/**
 * Reusable underline tab strip.
 * items: [{ value, label, count, icon: Icon }]
 */
export default function Tabs({ items, value, onChange, className, label = "Tabs" }) {
  if (!items?.length) return null;

  return (
    <div className={cn("border-b border-line", className)}>
      <div role="tablist" aria-label={label} className="flex gap-1">
        {items.map((item) => {
          const active = item.value === value;
          const Icon = item.icon;

          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`tab-${item.value}`}
              aria-selected={active}
              aria-controls={`tabpanel-${item.value}`}
              onClick={() => onChange(item.value)}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
                active
                  ? "border-primary-600 font-semibold text-primary-600"
                  : "border-transparent font-medium text-muted hover:border-line-strong hover:text-ink"
              )}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              {item.label}

              {item.count !== undefined && item.count !== null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                    active ? "bg-primary-50 text-primary-700" : "bg-muted-soft text-body"
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanel({ value, active, children, className }) {
  if (value !== active) return null;

  return (
    <div role="tabpanel" id={`tabpanel-${value}`} aria-labelledby={`tab-${value}`} className={className}>
      {children}
    </div>
  );
}
