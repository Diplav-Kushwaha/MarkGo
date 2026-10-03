import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, formatCurrency } from "../../lib/format";
import { formatDateLabel, orDash } from "./superadminFormat";
import {
  createdByLabel,
  neverExpires,
  subscriptionPeriod,
} from "./superadminPlanHelpers";
import SuperAdminSubStatusBadge from "./SuperAdminSubStatusBadge";
import { SACard, SACardHeader, SAButton } from "./SuperAdminUi";

/**
 * Subscription card + history for one company, built purely from what
 * GET /api/superadmin/companies/:id already returned. Nothing is derived here.
 */
export function CompanySubscriptionCard({ company, subscription, onAssign, statusAction }) {
  const isPendingPayment = company?.status === "PENDING_PAYMENT";
  const canAssign = company?.status !== "CANCELLED";

  return (
    <SACard>
      <SACardHeader
        title="Subscription"
        subtitle={isPendingPayment ? "This company has not completed payment." : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canAssign && (
              <SAButton variant="secondary" size="sm" onClick={onAssign}>
                Assign plan
              </SAButton>
            )}
            {statusAction}
          </div>
        }
      />

      <div className="space-y-4 p-5">
        {isPendingPayment && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-sm text-amber-700">
              This company has not completed payment. Assigning a plan will activate it.
            </p>
          </div>
        )}

        {!subscription ? (
          <p className="text-sm text-slate-500">
            This company has no subscription yet. Assign a plan to get it started.
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Plan</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                {orDash(subscription.planName)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Status</dt>
              <dd className="mt-0.5">
                <SuperAdminSubStatusBadge status={subscription.status} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Started</dt>
              <dd className="mt-0.5 text-sm text-slate-900">
                {formatDate(subscription.startDate)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Ends</dt>
              <dd className="mt-0.5 text-sm text-slate-900">
                {neverExpires(subscription.endDate)
                  ? "Never expires"
                  : formatDate(subscription.endDate)}
              </dd>
            </div>
            {!neverExpires(subscription.endDate) && (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">
                  Days left
                </dt>
                <dd
                  className={`mt-0.5 text-sm font-semibold ${
                    subscription.daysLeft <= 0
                      ? "text-red-600"
                      : subscription.daysLeft <= 7
                        ? "text-amber-600"
                        : "text-slate-900"
                  }`}
                >
                  {subscription.daysLeft} day
                  {subscription.daysLeft === 1 ? "" : "s"}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </SACard>
  );
}

/** Latest subscriptions for this company (the backend returns the last 5). */
export function CompanySubscriptionHistoryCard({ history }) {
  const items = Array.isArray(history) ? history : [];

  return (
    <SACard>
      <SACardHeader
        title="Subscription history"
        subtitle="The five most recent plans this company was on."
        actions={
          <Link
            to="/superadmin/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to companies
          </Link>
        }
      />

      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">
          No subscription history yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {orDash(item.planName)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {subscriptionPeriod(item.startDate, item.endDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(item.priceAtPurchase)}
                  </span>
                  <SuperAdminSubStatusBadge status={item.effectiveStatus} />
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Started by {createdByLabel(item.createdBy)} ·{" "}
                {formatDateLabel(item.createdAt || item.startDate)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SACard>
  );
}
