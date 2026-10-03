import { AlertTriangle, Clock, CreditCard, Wallet } from "lucide-react";
import {
  formatCompactCurrency,
  formatCount,
  formatDateLabel,
  formatFullCurrency,
  orDash,
  safeNumber,
} from "./superadminFormat";
import {
  billingLabelFor,
  paymentMethodLabel,
} from "./superadminPlanHelpers";
import SuperAdminSubStatusBadge from "./SuperAdminSubStatusBadge";
import { SACard, SACardHeader } from "./SuperAdminUi";

/** Stat card with an optional tone for the icon chip. */
function Stat({ label, value, hint, icon: Icon, tone = "slate" }) {
  const chips = {
    slate: "bg-slate-100 text-slate-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <SACard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        {Icon && (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chips[tone]}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </SACard>
  );
}

/**
 * "Subscriptions and revenue" block for the Overview tab. Every figure comes
 * straight from GET /api/superadmin/subscriptions/summary — nothing is
 * calculated here. Values that can be missing fall back to a dash.
 */
export default function SuperAdminSubSummary({ summary }) {
  const totals = summary?.totals || {};
  const subscriptions = summary?.subscriptions || {};
  const companies = summary?.companies || {};
  const byPlan = Array.isArray(summary?.byPlan) ? summary.byPlan : [];
  const byMethod = Array.isArray(summary?.byMethod) ? summary.byMethod : [];
  const recentPayments = Array.isArray(summary?.recentPayments)
    ? summary.recentPayments
    : [];

  // Used only to scale the bars, from the backend's own collected figures.
  const maxCollected = byPlan.reduce(
    (max, row) => Math.max(max, safeNumber(row.collected)),
    0
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Total collected"
          value={formatFullCurrency(totals.totalCollected)}
          hint={`${formatCount(safeNumber(totals.paidPaymentsCount))} paid payment(s)`}
          icon={Wallet}
        />
        <Stat
          label="Active subscriptions"
          value={formatCount(safeNumber(subscriptions.active))}
          hint="Currently running"
          icon={CreditCard}
        />
        <Stat
          label="Expiring in 7 days"
          value={formatCount(safeNumber(subscriptions.expiringIn7Days))}
          hint="Ends within a week"
          icon={Clock}
          tone="amber"
        />
        <Stat
          label="Expired"
          value={formatCount(safeNumber(subscriptions.expired))}
          hint="Past their end date"
          icon={AlertTriangle}
          tone="red"
        />
        <Stat
          label="Pending payment"
          value={formatCount(safeNumber(subscriptions.pending))}
          hint="Awaiting payment"
          icon={Clock}
          tone="amber"
        />
        <Stat
          label="Companies without a valid plan"
          value={formatCount(safeNumber(companies.withoutValidSubscription))}
          hint={`of ${formatCount(safeNumber(companies.total))} companies`}
          icon={AlertTriangle}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Collection by plan */}
        <SACard>
          <SACardHeader
            title="Collection by plan"
            subtitle="Paid payments grouped by the plan they were for"
          />
          {byPlan.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              No plans yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {byPlan.map((row) => (
                <li key={row.planId} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {orDash(row.planName)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {billingLabelFor(row.billingCycle)} ·{" "}
                        {formatCount(safeNumber(row.activeSubscriptions))} active ·{" "}
                        {formatCount(safeNumber(row.expiredSubscriptions))} expired
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className="text-sm font-semibold text-slate-900 tabular-nums"
                        title={formatFullCurrency(row.collected)}
                      >
                        {formatCompactCurrency(row.collected)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCount(safeNumber(row.paymentsCount))} payment(s)
                      </p>
                    </div>
                  </div>
                  {maxCollected > 0 && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-700"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((safeNumber(row.collected) / maxCollected) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SACard>

        {/* Collection by method */}
        <SACard>
          <SACardHeader
            title="Collection by method"
            subtitle="How the money came in"
          />
          {byMethod.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              No paid payments recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {byMethod.map((row) => (
                <li
                  key={row.method || "unknown"}
                  className="flex items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {paymentMethodLabel(row.method)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatCount(safeNumber(row.paymentsCount))} payment(s)
                    </p>
                  </div>
                  <p
                    className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums"
                    title={formatFullCurrency(row.collected)}
                  >
                    {formatCompactCurrency(row.collected)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SACard>
      </div>

      {/* Recent payments */}
      <SACard>
        <SACardHeader
          title="Recent payments"
          subtitle="The last 10 paid subscription payments"
        />
        {recentPayments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No payments recorded yet.
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {["Company", "Plan", "Amount", "Method", "Paid"].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPayments.map((payment, index) => (
                    <tr key={`${payment.companyName}-${index}`}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {orDash(payment.companyName)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {orDash(payment.planName)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatFullCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <SuperAdminSubStatusBadge status="PAID" />
                        <span className="ml-2 text-xs text-slate-500">
                          {paymentMethodLabel(payment.method)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateLabel(payment.paidAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 lg:hidden">
              {recentPayments.map((payment, index) => (
                <li key={`${payment.companyName}-m-${index}`} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                      {orDash(payment.companyName)}
                    </p>
                    <p className="shrink-0 text-sm font-semibold text-slate-900">
                      {formatFullCurrency(payment.amount)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {orDash(payment.planName)} ·{" "}
                    {paymentMethodLabel(payment.method)} ·{" "}
                    {formatDateLabel(payment.paidAt)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </SACard>
    </div>
  );
}
