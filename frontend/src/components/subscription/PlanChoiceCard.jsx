import { Check } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { LIMIT_ROWS, billingLabel, isUnlimited, limitLabel } from "./subscriptionHelpers";

/**
 * A plan as a selectable card. The action button is supplied by the parent so
 * the same card works on the Subscription page and the plan-required screen.
 */
export default function PlanChoiceCard({
  plan,
  isCurrent = false,
  action,
}) {
  const free = plan.billingCycle === "FREE";

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-surface p-6 shadow-card ${
        isCurrent ? "border-blue-200 ring-1 ring-blue-200" : "border-line"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
          <p className="mt-0.5 text-xs font-medium text-muted">
            {billingLabel(plan)}
          </p>
        </div>
        {isCurrent && (
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-800">
            Current plan
          </span>
        )}
      </header>

      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-ink">
          {free ? "Free" : formatCurrency(plan.price)}
        </span>
        {!free && <span className="text-xs text-muted">{billingLabel(plan)}</span>}
      </p>

      <dl className="mt-5 flex-1 space-y-2.5">
        {LIMIT_ROWS.map((row) => {
          const value = plan.limits?.[row.key] ?? null;
          const unlimited = isUnlimited(value);
          return (
            <div key={row.key} className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-body">{row.label}</dt>
              <dd className={`font-semibold ${unlimited ? "text-emerald-600" : "text-ink"}`}>
                {unlimited && (
                  <Check
                    className="mr-1 inline h-3.5 w-3.5 align-[-2px]"
                    aria-hidden="true"
                  />
                )}
                {limitLabel(value)}
              </dd>
            </div>
          );
        })}
      </dl>

      {action && <div className="mt-6">{action}</div>}
    </article>
  );
}
