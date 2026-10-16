import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  MoreHorizontal,
  Plus,
  Power,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { getAllCompanies } from "../../api/superAdminAuthApi";
import {
  deleteSuperAdminPendingCompany,
  setSuperAdminCompanyStatus,
} from "../../api/superAdminSubscriptionApi";
import {
  formatCount,
  formatDateLabel,
  joinLocation,
  orDash,
  safeNumber,
} from "../../components/superadmin/superadminFormat";
import { billingLabelFor, neverExpires } from "../../components/superadmin/superadminPlanHelpers";
import AddCompanyModal from "../../components/superadmin/AddCompanyModal";
import AssignPlanModal from "../../components/superadmin/AssignPlanModal";
import CompanyStatusBadge from "../../components/superadmin/CompanyStatusBadge";
import SuperAdminSubStatusBadge from "../../components/superadmin/SuperAdminSubStatusBadge";
import {
  CompanyStatusModal,
  DeletePendingModal,
} from "../../components/superadmin/CompanyStatusModals";
import {
  SAButton,
  SACard,
  SAEmptyState,
  SAErrorAlert,
  SAInput,
  SASelect,
  SATableSkeleton,
} from "../../components/superadmin/SuperAdminUi";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const SEARCH_DEBOUNCE_MS = 400;

/** Every CompanyStatus the backend defines, so the filter can send a valid one. */
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Inactive" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "PENDING_PAYMENT", label: "Payment pending" },
];

/** subscriptionState values accepted by the backend companies list. */
const SUBSCRIPTION_OPTIONS = [
  { value: "", label: "All subscriptions" },
  { value: "VALID", label: "Valid" },
  { value: "EXPIRED", label: "Expired" },
  { value: "NO_SUBSCRIPTION", label: "No subscription" },
];

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "name:asc", label: "Name (A-Z)" },
  { value: "name:desc", label: "Name (Z-A)" },
  { value: "email:asc", label: "Email (A-Z)" },
  { value: "email:desc", label: "Email (Z-A)" },
];

const COLUMNS = [
  "Company",
  "Official Email",
  "Location",
  "GST / Tax No.",
  "Subscription",
  "Status",
  "Vendors",
  "Customers",
  "Invoices",
  "Registered On",
  "Actions",
];

/** Small numeric pill used for the per-role counts. */
function CountCell({ value }) {
  const count = safeNumber(value);
  return (
    <span className="inline-flex min-w-9 justify-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 tabular-nums">
      {formatCount(count)}
    </span>
  );
}

/** Subscription cell: plan, status, end date and days left — all backend values. */
function SubscriptionCell({ subscription }) {
  if (!subscription) {
    return <span className="text-xs text-slate-400">No subscription</span>;
  }

  const days = subscription.daysLeft;
  const tone =
    neverExpires(subscription.endDate) || days === null
      ? "text-slate-500"
      : days <= 0
        ? "text-red-600"
        : days <= 7
          ? "text-amber-600"
          : "text-slate-600";

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-slate-900" title={subscription.planName}>
        {orDash(subscription.planName)}
      </p>
      <p className="text-xs text-slate-500">{billingLabelFor(subscription.billingCycle)}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <SuperAdminSubStatusBadge status={subscription.status} />
        <span className={`text-[11px] ${tone}`}>
          {neverExpires(subscription.endDate)
            ? "Never expires"
            : `${formatDateLabel(subscription.endDate)} · ${days} day${days === 1 ? "" : "s"} left`}
        </span>
      </div>
    </div>
  );
}

/** Per-row action menu. Which actions appear depends on the company status. */
function CompanyActions({ company, busy, onStatus, onAssign, onDeletePending }) {
  const [open, setOpen] = useState(false);
  const isActive = company.status === "ACTIVE";
  const isSuspended = company.status === "SUSPENDED";
  const isPending = company.status === "PENDING_PAYMENT";

  return (
    <div className="relative inline-block text-left">
      <SAButton
        variant="secondary"
        size="sm"
        aria-label={`Actions for ${company.name}`}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        disabled={busy}
        className="px-2"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </SAButton>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {(isActive || isSuspended) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onStatus(company);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <Power className="h-4 w-4" aria-hidden="true" />
                {isActive ? "Deactivate" : "Activate"}
              </button>
            )}

            {company.status !== "CANCELLED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onAssign(company);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Assign plan
              </button>
            )}

            {isPending && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onDeletePending(company);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete pending company
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** One table row on desktop. */
function CompanyRow({ company, busy, onStatus, onAssign, onDeletePending }) {
  const counts = company._count || {};

  return (
    <tr className="transition-colors hover:bg-slate-50">
      <td className="px-4 py-4">
        <Link
          to={`/superadmin/companies/${company.id}`}
          className="font-semibold text-slate-900 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded"
        >
          {orDash(company.name)}
        </Link>
        <p className="mt-0.5 max-w-[180px] truncate font-mono text-[11px] text-slate-500" title={company.slug}>
          {orDash(company.slug)}
        </p>
      </td>
      <td className="px-4 py-4">
        <span className="block max-w-[200px] truncate font-mono text-xs text-slate-700" title={company.email}>
          {orDash(company.email)}
        </span>
      </td>
      <td className="px-4 py-4">
        <span
          className="block max-w-[200px] truncate text-xs text-slate-500"
          title={joinLocation(company)}
        >
          {joinLocation(company)}
        </span>
      </td>
      <td className="px-4 py-4">
        <span className="block max-w-[140px] truncate font-mono text-xs text-slate-600" title={company.gstNumber}>
          {orDash(company.gstNumber)}
        </span>
      </td>
      <td className="px-4 py-4">
        <SubscriptionCell subscription={company.subscription} />
      </td>
      <td className="px-4 py-4">
        <CompanyStatusBadge status={company.status} />
      </td>
      <td className="px-4 py-4 text-center">
        <CountCell value={counts.vendors} />
      </td>
      <td className="px-4 py-4 text-center">
        <CountCell value={counts.customers} />
      </td>
      <td className="px-4 py-4 text-center">
        <CountCell value={counts.invoices} />
      </td>
      <td className="px-4 py-4 text-xs whitespace-nowrap text-slate-500 tabular-nums">
        {formatDateLabel(company.createdAt)}
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <Link
            to={`/superadmin/companies/${company.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-800 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            View
          </Link>
          <CompanyActions
            company={company}
            busy={busy}
            onStatus={onStatus}
            onAssign={onAssign}
            onDeletePending={onDeletePending}
          />
        </div>
      </td>
    </tr>
  );
}

/** Stacked card layout for small screens. */
function CompanyCard({ company, busy, onStatus, onAssign, onDeletePending }) {
  const counts = company._count || {};
  const location = joinLocation(company);

  const stat = (label, value) => (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900 tabular-nums">{formatCount(safeNumber(value))}</p>
    </div>
  );

  return (
    <li className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/superadmin/companies/${company.id}`}
            className="font-semibold text-slate-900 hover:text-blue-800"
          >
            {orDash(company.name)}
          </Link>
          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{orDash(company.slug)}</p>
        </div>
        <CompanyStatusBadge status={company.status} />
      </div>

      <dl className="mt-3 space-y-1 text-xs text-slate-500">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-slate-400">Email</dt>
          <dd className="min-w-0 flex-1 truncate font-mono">{orDash(company.email)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-slate-400">Location</dt>
          <dd className="min-w-0 flex-1 truncate">{location}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-slate-400">GST</dt>
          <dd className="min-w-0 flex-1 truncate font-mono">{orDash(company.gstNumber)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-slate-400">Registered</dt>
          <dd className="min-w-0 flex-1">{formatDateLabel(company.createdAt)}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Subscription</p>
        <div className="mt-1">
          <SubscriptionCell subscription={company.subscription} />
        </div>
      </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {stat("Vendors", counts.vendors)}
        {stat("Cust.", counts.customers)}
        {stat("Inv.", counts.invoices)}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Link
          to={`/superadmin/companies/${company.id}`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-800 hover:text-blue-700"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          View company
        </Link>
        <CompanyActions
          company={company}
          busy={busy}
          onStatus={onStatus}
          onAssign={onAssign}
          onDeletePending={onDeletePending}
        />
      </div>
    </li>
  );
}

export default function SuperAdminCompanies() {
  const DEFAULT_PAGINATION = { total: 0, page: 1, pageSize: 20, totalPages: 1 };

  // Draft text is debounced into the applied search term.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [subscriptionState, setSubscriptionState] = useState("");
  const [sortKey, setSortKey] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [reloadToken, setReloadToken] = useState(0);

  // Subscription actions
  const [successMsg, setSuccessMsg] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [assignTarget, setAssignTarget] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  // The last completed request. Keyed by the query so a stale response can
  // never overwrite a newer one, and so "loading" is derived rather than set
  // from inside the effect.
  const [result, setResult] = useState({
    key: null,
    companies: [],
    pagination: DEFAULT_PAGINATION,
    error: "",
  });

  // Guards against out-of-order responses when filters change quickly.
  const requestIdRef = useRef(0);
  // Last search term actually sent to the backend, so the debounce can tell
  // whether anything really changed before resetting pagination.
  const appliedSearchRef = useRef("");

  // Debounce the search box (~400ms) and reset to page 1 when it applies.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next === appliedSearchRef.current) return;
      appliedSearchRef.current = next;
      setSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [sortBy, sortOrder] = useMemo(() => sortKey.split(":"), [sortKey]);

  // Everything the table shows comes from the backend — no client filtering.
  const queryKey = `${search}|${status}|${subscriptionState}|${sortBy}|${sortOrder}|${page}|${pageSize}|${reloadToken}`;

  useEffect(() => {
    let active = true;
    const requestId = ++requestIdRef.current;

    getAllCompanies({
      search: search || undefined,
      status: status || undefined,
      subscriptionState: subscriptionState || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize,
    })
      .then((res) => {
        // A slower earlier request must not overwrite a newer result.
        if (!active || requestId !== requestIdRef.current) return;

        if (res?.success && res.data) {
          setResult({
            key: queryKey,
            companies: Array.isArray(res.data.companies) ? res.data.companies : [],
            pagination: res.data.pagination || DEFAULT_PAGINATION,
            error: "",
          });
        } else {
          setResult({
            key: queryKey,
            companies: [],
            pagination: DEFAULT_PAGINATION,
            error: res?.message || "Could not load registered companies.",
          });
        }
      })
      .catch((err) => {
        if (!active || requestId !== requestIdRef.current) return;
        const statusCode = err.response?.status;
        setResult({
          key: queryKey,
          companies: [],
          pagination: DEFAULT_PAGINATION,
          error:
            statusCode === 401 || statusCode === 403
              ? "Your session has expired. Please sign in again."
              : err.response?.data?.message || "Failed to load registered companies.",
        });
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  // Derived: still loading until a result for the current query arrives.
  const loading = result.key !== queryKey;
  const companies = result.companies;
  const pagination = result.pagination;
  const error = result.error;

  const retry = () => {
    // Bumping the token changes the query key, which flips `loading` back on
    // and re-runs the effect.
    setReloadToken((token) => token + 1);
  };

  const hasFilters = Boolean(search || status || subscriptionState);
  const total = safeNumber(pagination.total);
  const currentPage = safeNumber(pagination.page) || 1;
  const currentPageSize = safeNumber(pagination.pageSize) || pageSize;
  const totalPages = safeNumber(pagination.totalPages) || 1;
  const from = total === 0 ? 0 : (currentPage - 1) * currentPageSize + 1;
  const to = Math.min(currentPage * currentPageSize, total);

  const clearFilters = () => {
    setSearchInput("");
    appliedSearchRef.current = "";
    setSearch("");
    setStatus("");
    setSubscriptionState("");
    setPage(1);
  };

  const handleStatusConfirm = async () => {
    if (!statusTarget) return;
    const next = statusTarget.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setActionBusy(true);
    setStatusError("");
    try {
      const res = await setSuperAdminCompanyStatus(statusTarget.id, next);
      if (res?.success) {
        setSuccessMsg(
          res.data?.changed === false
            ? `${statusTarget.name} is already ${next === "ACTIVE" ? "active" : "inactive"}.`
            : `${statusTarget.name} is now ${next === "ACTIVE" ? "active" : "inactive"}.`
        );
        setStatusTarget(null);
        retry();
      } else {
        setStatusError(res?.message || "Could not change the company status.");
      }
    } catch (err) {
      setStatusError(err.response?.data?.message || "Could not change the company status.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setActionBusy(true);
    setDeleteError("");
    try {
      const res = await deleteSuperAdminPendingCompany(deleteTarget.id);
      if (res?.success) {
        setSuccessMsg(`${deleteTarget.name} was deleted.`);
        setDeleteTarget(null);
        retry();
      } else {
        setDeleteError(res?.message || "Could not delete the company.");
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Could not delete the company.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Companies</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every tenant on the platform, with its plan and account state.
          </p>
        </div>
        <SAButton
          variant="primary"
          icon={Plus}
          onClick={() => setAddOpen(true)}
          disabled={actionBusy}
        >
          Add company
        </SAButton>
      </div>

      {successMsg && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {successMsg}
        </div>
      )}

      {/* Controls — every one of these hits the backend */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label htmlFor="company-search" className="mb-1.5 block text-sm font-medium text-slate-700">
            Search companies
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <SAInput
              id="company-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Company name, email, slug or GST number…"
              className="pl-9 pr-9"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  appliedSearchRef.current = "";
                  setSearch("");
                  setPage(1);
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 lg:w-auto">
          <SASelect
            id="company-status"
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="lg:w-40"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SASelect>

          <SASelect
            id="company-subscription"
            label="Subscription"
            value={subscriptionState}
            onChange={(e) => {
              setSubscriptionState(e.target.value);
              setPage(1);
            }}
            className="lg:w-44"
          >
            {SUBSCRIPTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SASelect>

          <SASelect
            id="company-sort"
            label="Sort"
            value={sortKey}
            onChange={(e) => {
              setSortKey(e.target.value);
              setPage(1);
            }}
            className="lg:w-44"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SASelect>

          <SASelect
            id="company-page-size"
            label="Rows"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="lg:w-24"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </SASelect>
        </div>
      </div>

      {error && <SAErrorAlert message={error} onRetry={{ retry }} />}

      {/* Table */}
      <SACard className="overflow-hidden">
        {loading ? (
          <SATableSkeleton rows={6} columns={6} />
        ) : companies.length === 0 ? (
          <SAEmptyState
            icon={Building2}
            title="No companies found"
            description={
              hasFilters
                ? "No companies match the current search or status filter."
                : "No companies have registered on the platform yet."
            }
            action={
              hasFilters ? (
                <SAButton variant="secondary" onClick={clearFilters}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Clear filters
                </SAButton>
              ) : null
            }
          />
        ) : (
          <>
            {/* Desktop: scrollable table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {COLUMNS.map((heading, index) => (
                      <th
                        key={heading}
                        scope="col"
                        className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${
                          index >= 6 && index <= 10 ? "text-center" : ""
                        } whitespace-nowrap`}
                      >
                        {heading === "Registered On" ? (
                          <span className="inline-flex items-center gap-1">
                            {heading}
                            <ArrowUpDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
                          </span>
                        ) : (
                          heading
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companies.map((company) => (
                    <CompanyRow
                      key={company.id}
                      company={company}
                      busy={actionBusy}
                      onStatus={setStatusTarget}
                      onAssign={setAssignTarget}
                      onDeletePending={setDeleteTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet: stacked cards */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {companies.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  busy={actionBusy}
                  onStatus={setStatusTarget}
                  onAssign={setAssignTarget}
                  onDeletePending={setDeleteTarget}
                />
              ))}
            </ul>
          </>
        )}

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 sm:flex-row">
            <p>
              Showing{" "}
              <span className="font-semibold text-slate-900 tabular-nums">{from}</span> to{" "}
              <span className="font-semibold text-slate-900 tabular-nums">{to}</span> of{" "}
              <span className="font-semibold text-slate-900 tabular-nums">{formatCount(total)}</span>{" "}
              companies
            </p>

            <nav className="flex items-center gap-1" aria-label="Pagination">
              <SAButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Previous
              </SAButton>

              <span className="px-3 text-xs font-semibold text-slate-700 tabular-nums">
                Page {currentPage} of {totalPages}
              </span>

              <SAButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </SAButton>
            </nav>
          </div>
        )}
      </SACard>

      {/* Add company — mounted only while open, so the form starts fresh */}
      {addOpen && (
        <AddCompanyModal
          isOpen
          onClose={() => setAddOpen(false)}
          onSuccess={retry}
        />
      )}

      {/* Assign plan */}
      {assignTarget && (
        <AssignPlanModal
          isOpen
          company={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSuccess={retry}
        />
      )}

      {/* Activate / deactivate */}
      <CompanyStatusModal
        open={Boolean(statusTarget)}
        company={statusTarget}
        onClose={() => {
          setStatusTarget(null);
          setStatusError("");
        }}
        onConfirm={handleStatusConfirm}
        saving={actionBusy}
        error={statusError}
      />

      {/* Delete pending company */}
      <DeletePendingModal
        open={Boolean(deleteTarget)}
        company={deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={handleDeleteConfirm}
        saving={actionBusy}
        error={deleteError}
      />
    </div>
  );
}
