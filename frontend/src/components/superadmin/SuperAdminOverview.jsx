import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  FileText,
  Landmark,
  Receipt,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import { getSuperAdminDashboard } from "../../api/superAdminAuthApi";
import { getSuperAdminSubscriptionSummary } from "../../api/superAdminSubscriptionApi";
import { useAuth } from "../../context/AuthContext";
import SuperAdminSubSummary from "./SuperAdminSubSummary";
import {
  formatCompactCurrency,
  formatCount,
  formatDateLabel,
  formatFullCurrency,
  orDash,
  safeNumber,
} from "../superadmin/superadminFormat";
import {
  SACard,
  SACardHeader,
  SAErrorAlert,
  SAStatCardSkeleton,
  SATone,
  SASkeleton,
} from "./SuperAdminUi";

/** Big metric card: icon, label, large value. */
function MetricCard({ label, value, hint, icon: Icon, title }) {
  return (
    <SACard className="p-5" title={title}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </SACard>
  );
}

/** Small metric card for the secondary row. */
function MiniMetricCard({ label, value, icon: Icon }) {
  return (
    <SACard className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
        </div>
      </div>
    </SACard>
  );
}

export default function SuperAdminOverview({ onNavigateTab }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  // The subscription section loads on its own, so a failure here never affects
  // the rest of the Overview.
  const [subSummary, setSubSummary] = useState(null);
  const [subLoading, setSubLoading] = useState(true);
  const [subError, setSubError] = useState("");
  const [subReloadToken, setSubReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    getSuperAdminSubscriptionSummary()
      .then((res) => {
        if (!active) return;
        if (res?.success && res.data) {
          setSubSummary(res.data);
          setSubError("");
        } else {
          setSubError(res?.message || "Could not load subscription numbers.");
        }
      })
      .catch((err) => {
        if (!active) return;
        const status = err.response?.status;
        setSubError(
          status === 401 || status === 403
            ? "Your session has expired. Please sign in again."
            : err.response?.data?.message || "Could not load subscription numbers."
        );
      })
      .finally(() => {
        if (active) setSubLoading(false);
      });

    return () => {
      active = false;
    };
  }, [subReloadToken]);

  const subRetry = { retry: () => { setSubLoading(true); setSubReloadToken((t) => t + 1); } };

  useEffect(() => {
    let active = true;

    getSuperAdminDashboard()
      .then((res) => {
        if (!active) return;
        if (res?.success && res.data) {
          setData(res.data);
          setError("");
        } else {
          setError(res?.message || "Could not load the platform overview.");
        }
      })
      .catch((err) => {
        if (!active) return;
        const status = err.response?.status;
        setError(
          status === 401 || status === 403
            ? "Your session has expired. Please sign in again."
            : err.response?.data?.message || "Could not load the platform overview."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  const retry = { retry: () => { setLoading(true); setReloadToken((t) => t + 1); } };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SAStatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SAStatCardSkeleton key={i} />
          ))}
        </div>
        <SACard className="p-6">
          <SASkeleton className="h-4 w-40" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SASkeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </SACard>
      </div>
    );
  }

  if (error && !data) {
    return <SAErrorAlert message={error} onRetry={retry} />;
  }

  // Defensive reads: every value below falls back to 0 / "-" so the console can
  // never render NaN, undefined or null.
  const companies = data?.companies || {};
  const byStatus = companies.byStatus || {};
  const people = data?.people || {};
  const invoices = data?.invoices || {};
  const recentCompanies = Array.isArray(data?.recentCompanies) ? data.recentCompanies : [];

  const totalCompanies = safeNumber(companies.total);
  const totalInvoices = safeNumber(invoices.total);
  const totalBilled = safeNumber(invoices.totalBilled);
  const totalExpense = safeNumber(invoices.totalExpense);
  const profitOrLoss = safeNumber(invoices.profitOrLoss);
  const isProfit = profitOrLoss >= 0;

  // Status segments straight from the backend, with a colour per real status.
  const STATUS_META = {
    ACTIVE: { color: "bg-emerald-500", chip: "emerald" },
    SUSPENDED: { color: "bg-amber-500", chip: "amber" },
    CANCELLED: { color: "bg-slate-400", chip: "slate" },
  };
  const statusRows = Object.entries(byStatus)
    .map(([key, value]) => ({
      key,
      count: safeNumber(value),
      meta: STATUS_META[key] || { color: "bg-slate-300", chip: "slate" },
    }))
    .filter((row) => row.count > 0 || row.key)
    .sort((a, b) => b.count - a.count);

  const segmentTotal = statusRows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      {error && <SAErrorAlert message={error} onRetry={retry} />}

      {/* Primary totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Companies"
          value={formatCount(totalCompanies)}
          hint="All registered tenants"
          icon={Building2}
          title={`${formatCount(totalCompanies)} companies`}
        />
        <MetricCard
          label="Total Invoices"
          value={formatCount(totalInvoices)}
          hint="Excludes cancelled invoices"
          icon={FileText}
          title={`${formatCount(totalInvoices)} invoices`}
        />
        <MetricCard
          label="Total Billed"
          value={formatCompactCurrency(totalBilled)}
          hint="Sum of all non-cancelled invoices"
          icon={Receipt}
          title={formatFullCurrency(totalBilled)}
        />
        <MetricCard
          label="Profit / Loss"
          value={formatCompactCurrency(Math.abs(profitOrLoss))}
          hint={isProfit ? "Platform is profitable" : "Platform is running at a loss"}
          icon={isProfit ? TrendingUp : ArrowDownRight}
          title={formatFullCurrency(profitOrLoss)}
        />
      </div>

      {/* People counts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetricCard label="Staff" value={formatCount(people.staff)} icon={UserCog} />
        <MiniMetricCard label="Accountants" value={formatCount(people.accountants)} icon={Landmark} />
        <MiniMetricCard label="Vendors" value={formatCount(people.vendors)} icon={Building2} />
        <MiniMetricCard label="Customers" value={formatCount(people.customers)} icon={Users} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Company status breakdown */}
        <SACard>
          <SACardHeader
            title="Company status"
            subtitle="Distribution of all tenants by account state"
          />
          <div className="p-5">
            {segmentTotal === 0 ? (
              <p className="text-sm text-slate-500">No companies registered yet.</p>
            ) : (
              <>
                {/* Segmented bar */}
                <div
                  className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
                  role="img"
                  aria-label={statusRows
                    .map((row) => `${row.key} ${row.count}`)
                    .join(", ")}
                >
                  {statusRows.map((row) =>
                    row.count > 0 ? (
                      <div
                        key={row.key}
                        className={row.meta.color}
                        style={{ width: `${(row.count / segmentTotal) * 100}%` }}
                        title={`${row.key}: ${row.count}`}
                      />
                    ) : null
                  )}
                </div>

                <ul className="mt-4 space-y-2.5">
                  {statusRows.map((row) => (
                    <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${row.meta.color}`}
                          aria-hidden="true"
                        />
                        {row.key.charAt(0) + row.key.slice(1).toLowerCase()}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-slate-400 tabular-nums">
                          {totalCompanies > 0
                            ? `${Math.round((row.count / totalCompanies) * 100)}%`
                            : "0%"}
                        </span>
                        <span className="w-10 text-right font-semibold text-slate-900 tabular-nums">
                          {formatCount(row.count)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </SACard>

        {/* Financial summary */}
        <SACard>
          <SACardHeader
            title="Financial summary"
            subtitle="Accrual basis: invoiced amounts minus billed amounts"
          />
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-600">Total billed</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatFullCurrency(totalBilled)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-600">Total expense</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatFullCurrency(totalExpense)}
              </span>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-slate-900">
                  {isProfit ? "Profit" : "Loss"}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-lg font-bold tabular-nums ${
                    isProfit ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {isProfit ? (
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isProfit ? "+" : "−"}
                  {formatFullCurrency(Math.abs(profitOrLoss))}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Accrual-based figure: total billed minus total expense across all companies.
                It reflects invoiced and billed amounts, not cash received.
              </p>
            </div>
          </div>
        </SACard>
      </div>

      {/* Recent companies */}
      <SACard>
        <SACardHeader
          title="Recent companies"
          subtitle="The 5 most recently registered tenants"
          actions={
            <Link
              to="/superadmin/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              Manage companies
            </Link>
          }
        />
        {recentCompanies.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No companies registered yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentCompanies.map((company) => (
              <li
                key={company.id}
                className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900" title={company.name}>
                    {orDash(company.name)}
                  </p>
                  <p className="truncate font-mono text-xs text-slate-500" title={company.email}>
                    {orDash(company.email)}
                  </p>
                </div>

                <span className="hidden rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 sm:inline-block">
                  {orDash(company.slug)}
                </span>

                <span className="text-xs text-slate-500 tabular-nums">
                  {formatDateLabel(company.createdAt)}
                </span>

                <Link
                  to={`/superadmin/companies/${company.id}`}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-800 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SACard>

      {/* Subscriptions and revenue — independent load, own error + retry */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            Subscriptions and revenue
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab?.("Plans")}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              Manage plans
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab?.("Subscriptions")}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              View all subscriptions
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500">Collection counts paid payments only.</p>

        {subError && <SAErrorAlert message={subError} onRetry={subRetry} />}

        {subLoading ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SAStatCardSkeleton key={i} />
              ))}
            </div>
            <SACard className="p-6">
              <SASkeleton className="h-4 w-40" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SASkeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            </SACard>
          </>
        ) : subSummary ? (
          <SuperAdminSubSummary summary={subSummary} />
        ) : null}
      </div>

      {/* Administrator identity — deliberately secondary */}
      <SACard>
        <SACardHeader title="Administrator identity" subtitle="Who is signed in to this console" />
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Account ID</p>
            <p className="mt-1 truncate font-mono text-xs text-slate-700" title={user?.id}>
              {orDash(user?.id || user?.userId)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Primary email</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-900" title={user?.email}>
              {orDash(user?.email)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Authorization</p>
            <div className="mt-1">
              <SATone tone="primary">{orDash(user?.role || "SUPERADMIN")}</SATone>
            </div>
          </div>
        </div>
      </SACard>
    </div>
  );
}
