import { isUnlimited, limitLabel } from "./subscriptionHelpers";

/**
 * One usage row: label, "used / limit" and a bar for numeric limits.
 *
 * The bar turns amber from 80% and red at 100% with "Limit reached".
 * Nothing is described as blocked — enforcement is not part of this screen.
 * An unlimited row shows the count only.
 */
export default function UsageBar({ label, used, limit }) {
  const unlimited = isUnlimited(limit);
  const count = Number(used) || 0;

  if (unlimited) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-sm text-body">{label}</span>
        <span className="text-sm font-semibold text-ink">
          {count} <span className="font-normal text-muted">/ Unlimited</span>
        </span>
      </div>
    );
  }

  const max = Number(limit) || 0;
  const percent = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0;
  const reached = count >= max;
  const warn = !reached && percent >= 80;

  const barClass = reached
    ? "bg-red-500"
    : warn
      ? "bg-amber-500"
      : "bg-primary-600";

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-body">{label}</span>
        <span
          className={`text-sm font-semibold ${
            reached ? "text-red-600" : warn ? "text-amber-600" : "text-ink"
          }`}
        >
          {limitLabel(max)}
          <span className="font-normal text-muted"> used {count}</span>
          {reached && <span className="ml-1.5 font-medium">Limit reached</span>}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-primary-100"
        role="progressbar"
        aria-label={`${label} usage`}
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
