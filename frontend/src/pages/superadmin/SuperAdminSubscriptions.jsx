import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ListFilter, RefreshCw, Search, X } from "lucide-react";
import {
  getSuperAdminPlans,
  getSuperAdminSubscriptions,
} from "../../api/superAdminSubscriptionApi";
import {
  formatCount,
  formatFullCurrency,
  orDash,
  safeNumber,
} from "../../components/superadmin/superadminFormat";
import {
  billingLabelFor,
  createdByLabel,
  neverExpires,
  subscriptionPeriod,
} from "../../components/superadmin/superadminPlanHelpers";
import SuperAdminSubStatusBadge from "../../components/superadmin/SuperAdminSubStatusBadge";
import {
  SAButton,
  SACard,
  SAEmptyState,
  SAErrorAlert,
  SAInput,
  SASelect,
  SAStatusBadge,
  SATableSkeleton,
} from "../../components/superadmin/SuperAdminUi";

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZES = [10, 20, 50];
const EXPIRING_WINDOWS = [7, 14, 30, 90];

const STATE_OPTIONS = [
  { value: "", label: "All states" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRING", label: "Expiring soon" },
  { value: "EXPIRED", label: "Expired" },
  { value: "PENDING", label: "Pending" },
  { value: "CANCELLED", label: "Cancelled" },
];

const EMPTY_PAGINATION = { total: 0, page: 1, pageSize: 20, totalPages: 1 };

export default function SuperAdminSubscriptions() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [planId, setPlanId] = useState("");
  const [days, setDays] = useState("7");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [plans, setPlans] = useState([]);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  // Guards against a slow earlier response overwriting a newer one.
  const requestIdRef = useRef(0);

  const retry = useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  // Plan list only feeds the filter dropdown.
  useEffect(() => {
    let active = true;

    getSuperAdminPlans()
      .then((res) => {
        if (active && res?.success) {
          setPlans(Array.isArray(res.data?.plans) ? res.data.plans : []);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Debounce the search box, and reset to page 1 when it applies.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((previous) => {
        if (searchInput.trim() === previous) return previous;
        setPage(1);
        return searchInput.trim();
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Everything below is filtered and paged by the backend.
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let active = true;

    getSuperAdminSubscriptions({
      search: search || undefined,
      state: state || undefined,
      planId: planId || undefined,
      days: state === "EXPIRING" ? days : undefined,
      page,
      pageSize,
    })
      .then((res) => {
        if (!active || requestId !== requestIdRef.current) return;
        if (res?.success) {
          setItems(Array.isArray(res.data?.items) ? res.data.items : []);
          setPagination(res.data?.pagination || EMPTY_PAGINATION);
          setError("");
        } else {
          setError(res?.message || "Could not load subscriptions.");
        }
      })
      .catch((err) => {
        if (!active || requestId !== requestIdRef.current) return;
        setError(err.response?.data?.message || "Could not load subscriptions.");
      })
      .finally(() => {
        if (active && requestId === requestIdRef.current) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [search, state, planId, days, page, pageSize, reloadToken]);

  const changeFilter = (setter, value) => {
    setter(value);
    setPage(1);
  };

  const hasFilters = Boolean(search || state || planId);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setState("");
    setPlanId("");
    setPage(1);
  };

  const total = safeNumber(pagination.total);
  const currentPage = safeNumber(pagination.page) || 1;
  const currentSize = safeNumber(pagination.pageSize) || pageSize;
  const totalPages = safeNumber(pagination.totalPages) || 1;
  const from = total === 0 ? 0 : (currentPage - 1) * currentSize + 1;
  const to = Math.min(currentPage * currentSize, total);

  // Days-left cell: amber at 7 or fewer, red at 0, blank when never expiring.
  const daysLeftCell = (subscription) => {
    if (neverExpires(subscription.endDate)) {
      return <span className="text-slate-400">—</span>;
    }
    const value = safeNumber(subscription.daysLeft);
    const tone = value <= 0 ? "text-red-600" : value <= 7 ? "text-amber-600" : "text-slate-900";
    return (
      <span className={`font-semibold tabular-nums ${tone}`}>
        {value} {value === 1 ? "day" : "days"}
      </span>
    );
  };

  const planCell = (subscription) => (
    <div className="min-w-0">
      <p className="truncate font-medium text-slate-900" title={subscription.plan?.name}>
        {orDash(subscription.plan?.name)}
      </p>
      <p className="text-xs text-slate-500">
        {billingLabelFor(subscription.billingCycle)}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Subscriptions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every plan a company has bought across the platform.
          </p>
        </div>
        <SAButton variant="secondary" icon={RefreshCw} onClick={retry} disabled={loading}>
          Refresh
        </SAButton>
      </div>

      {/* Filters — all applied by the backend */}
      <SACard className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <SAInput
              id="sub-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Company name, slug or email…"
              className="pl-9 pr-9"
              aria-label="Search subscriptions"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <SASelect
            id="sub-state"
            label="State"
            value={state}
            onChange={(e) => changeFilter(setState, e.target.value)}
          >
            {STATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SASelect>

          <SASelect
            id="sub-plan"
            label="Plan"
            value={planId}
            onChange={(e) => changeFilter(setPlanId, e.target.value)}
          >
            <option value="">All plans</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </SASelect>

          <SASelect
            id="sub-days"
            label={state === "EXPIRING" ? "Expiring within" : "Page size"}
            value={state === "EXPIRING" ? days : String(pageSize)}
            onChange={(e) => {
              if (state === "EXPIRING") {
                changeFilter(setDays, e.target.value);
              } else {
                changeFilter(setPageSize, Number(e.target.value));
              }
            }}
          >
            {state === "EXPIRING"
              ? EXPIRING_WINDOWS.map((window) => (
                  <option key={window} value={window}>
                    {window} days
                  </option>
                ))
              : PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
          </SASelect>
        </div>

        {hasFilters && (
          <div className="mt-3">
            <SAButton variant="ghost" icon={X} onClick={clearFilters} disabled={loading}>
              Clear filters
            </SAButton>
          </div>
        )}
      </SACard>

      {error && <SAErrorAlert message={error} onRetry={{ retry }} />}

      <SACard>
        {loading ? (
          <SATableSkeleton rows={8} columns={7} />
        ) : items.length === 0 ? (
          <SAEmptyState
            icon={ListFilter}
            title={hasFilters ? "No subscriptions match these filters." : "No subscriptions yet."}
            description={
              hasFilters
                ? "Try a different state, plan or search term."
                : "Subscriptions appear here once companies buy a plan."
            }
            action={
              hasFilters ? (
                <SAButton variant="secondary" onClick={clearFilters}>
                  Clear filters
                </SAButton>
              ) : null
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {["Company", "Plan", "Period", "Price", "Status", "Days left", "Started by"].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/superadmin/companies/${item.company?.id}`}
                          className="font-medium text-slate-900 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded"
                        >
                          {orDash(item.company?.name)}
                        </Link>
                        <p className="font-mono text-xs text-slate-500">
                          {orDash(item.company?.slug)}
                        </p>
                        {item.company?.status && item.company.status !== "ACTIVE" && (
                          <div className="mt-1">
                            <SAStatusBadge status={item.company.status} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{planCell(item)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {subscriptionPeriod(item.startDate, item.endDate)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {formatFullCurrency(item.priceAtPurchase)}
                      </td>
                      <td className="px-4 py-3">
                        <SuperAdminSubStatusBadge status={item.effectiveStatus} />
                      </td>
                      <td className="px-4 py-3">{daysLeftCell(item)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {createdByLabel(item.createdBy)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {items.map((item) => (
                <li key={item.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/superadmin/companies/${item.company?.id}`}
                        className="font-medium text-slate-900"
                      >
                        {orDash(item.company?.name)}
                      </Link>
                      <p className="truncate font-mono text-xs text-slate-500">
                        {orDash(item.company?.slug)}
                      </p>
                    </div>
                    <SuperAdminSubStatusBadge status={item.effectiveStatus} />
                  </div>

                  <p className="mt-2 text-sm text-slate-600">
                    {orDash(item.plan?.name)} ·{" "}
                    {billingLabelFor(item.billingCycle)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {subscriptionPeriod(item.startDate, item.endDate)}
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {formatFullCurrency(item.priceAtPurchase)} ·{" "}
                    <span className="text-slate-600">
                      {createdByLabel(item.createdBy)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm">{daysLeftCell(item)}</p>

                  {item.company?.status && item.company.status !== "ACTIVE" && (
                    <div className="mt-2">
                      <SAStatusBadge status={item.company.status} />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-500">
                Showing <span className="font-medium text-slate-900">{from}</span> to{" "}
                <span className="font-medium text-slate-900">{to}</span> of{" "}
                <span className="font-medium text-slate-900">{formatCount(total)}</span>{" "}
                subscriptions
              </p>

              <div className="flex items-center gap-2">
                <SAButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || loading}
                >
                  Previous
                </SAButton>

                <span className="text-xs text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>

                <SAButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || loading}
                >
                  Next
                </SAButton>
              </div>
            </div>
          </>
        )}
      </SACard>
    </div>
  );
}
