import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { getSuperAdminCompanyDetails } from "../../api/superAdminAuthApi";
import {
  deleteSuperAdminPendingCompany,
  setSuperAdminCompanyStatus,
} from "../../api/superAdminSubscriptionApi";
import { formatCurrency } from "../../lib/format";
import { formatCount, formatDateLabel, orDash, safeNumber } from "../../components/superadmin/superadminFormat";
import CompanyStatusBadge from "../../components/superadmin/CompanyStatusBadge";
import AssignPlanModal from "../../components/superadmin/AssignPlanModal";
import {
  CompanySubscriptionCard,
  CompanySubscriptionHistoryCard,
} from "../../components/superadmin/CompanySubscriptionCards";
import {
  CompanyStatusModal,
  DeletePendingModal,
} from "../../components/superadmin/CompanyStatusModals";
import {
  SACard,
  SACardHeader,
  SAButton,
  SAErrorAlert,
  SAStatCardSkeleton,
  SATone,
} from "../../components/superadmin/SuperAdminUi";

/** Label + value pair, used in the company info grid. */
function InfoRow({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd
        className={`mt-0.5 truncate text-sm text-slate-900 ${mono ? "font-mono text-xs" : ""}`}
        title={typeof value === "string" ? value : undefined}
      >
        {value || <span className="text-slate-400">Not provided</span>}
      </dd>
    </div>
  );
}

/** Metric card. `tone` drives the accent so profit/loss reads at a glance. */
function MetricCard({ label, value, hint, icon: Icon, tone = "slate", signed = false }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    emerald: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-800",
  };

  return (
    <SACard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
        {signed && value > 0 ? "+" : ""}
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </SACard>
  );
}

export default function SuperAdminCompanyDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  // Subscription actions
  const [actionBusy, setActionBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // The fetch lives inside the effect (rather than in a callback the effect
  // calls) so state only ever updates from a promise continuation.
  useEffect(() => {
    let active = true;

    getSuperAdminCompanyDetails(id)
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          setData(res.data);
          setError("");
        } else {
          setError(res.message || "Failed to load company details.");
        }
      })
      .catch((err) => {
        if (!active) setError(err.response?.data?.message || "Failed to load company details.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, reloadToken]);

  const retry = () => {
    setLoading(true);
    setError("");
    setReloadToken((token) => token + 1);
  };

  const handleStatusConfirm = async () => {
    if (!data?.company) return;
    const next = data.company.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setActionBusy(true);
    setStatusError("");
    try {
      const res = await setSuperAdminCompanyStatus(data.company.id, next);
      if (res?.success) {
        setSuccessMsg(
          res.data?.changed === false
            ? `This company is already ${next === "ACTIVE" ? "active" : "inactive"}.`
            : `Company is now ${next === "ACTIVE" ? "active" : "inactive"}.`
        );
        setStatusOpen(false);
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
    if (!data?.company) return;
    setActionBusy(true);
    setDeleteError("");
    try {
      const res = await deleteSuperAdminPendingCompany(data.company.id);
      if (res?.success) {
        setSuccessMsg("The pending company was deleted.");
        setDeleteOpen(false);
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((i) => (
            <SAStatCardSkeleton key={i} />
          ))}
        </div>
        <SACard>
          <SAStatCardSkeleton />
        </SACard>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          to="/superadmin/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to companies
        </Link>
        <SAErrorAlert message={error || "Company not found."} onRetry={{ retry }} />
      </div>
    );
  }

  const { company, finance, counts } = data;
  const isProfit = safeNumber(finance.profitOrLoss) >= 0;
  const location = [company.city, company.country].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <Link
        to="/superadmin/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-blue-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to companies
      </Link>

      {/* 1. Company info */}
      <SACard className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{orDash(company.name)}</h1>
              <CompanyStatusBadge status={company.status} />
              {company.plan && (
                <SATone tone="emerald">
                  {company.plan.name} · {formatCurrency(company.plan.price)}
                </SATone>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="truncate" title={company.email}>
                {orDash(company.email)}
              </span>
              <span className="text-slate-300">·</span>
              <span className="font-mono">{orDash(company.slug)}</span>
            </p>
          </div>

          <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
            <InfoRow label="GST number" value={orDash(company.gstNumber)} mono />
            <InfoRow label="Location" value={location} />
            <InfoRow label="Address" value={orDash(company.address)} />
            <InfoRow label="Registered on" value={formatDateLabel(company.createdAt)} />
            <InfoRow
              label="Primary admin"
              value={orDash(company.admin?.fullName || company.admin?.email)}
            />
            <InfoRow label="Admin email" value={orDash(company.admin?.email)} />
            <InfoRow
              label="Last login"
              value={company.admin?.lastLoginAt ? formatDateLabel(company.admin.lastLoginAt) : "Never"}
            />
            <InfoRow
              label="Admin status"
              value={company.admin ? (company.admin.isActive ? "Active" : "Deactivated") : "No admin"}
            />
          </dl>
        </div>
      </SACard>

      {/* 2. Profit / loss */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Total revenue"
          value={formatCurrency(finance.totalRevenue)}
          hint={`${formatCount(finance.invoiceCount)} invoice(s) · excludes cancelled`}
          icon={Wallet}
          tone="emerald"
        />
        <MetricCard
          label="Total expense"
          value={formatCurrency(finance.totalExpense)}
          hint={`${formatCount(finance.billCount)} bill(s)`}
          icon={Wallet}
          tone="slate"
        />
        <MetricCard
          label="Profit / loss"
          value={formatCurrency(Math.abs(safeNumber(finance.profitOrLoss)))}
          hint={`${isProfit ? "Profit" : "Loss"} · revenue minus expense`}
          icon={isProfit ? TrendingUp : TrendingDown}
          tone={isProfit ? "emerald" : "red"}
          signed
        />
      </div>

      {/* 3. Headcount — same figures the Companies list shows */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Total staff"
          value={formatCount(counts.staff)}
          hint="Company staff members"
          icon={Users}
          tone="blue"
        />
        <MetricCard
          label="Total accountants"
          value={formatCount(counts.accountants)}
          hint="Bookkeepers and CPAs"
          icon={UserCog}
          tone="blue"
        />
        <MetricCard
          label="Total customers"
          value={formatCount(counts.customers)}
          hint="Active customer records"
          icon={Building2}
          tone="blue"
        />
        <MetricCard
          label="Total vendors"
          value={formatCount(counts.vendors)}
          hint="Active vendor records"
          icon={Building2}
          tone="blue"
        />
      </div>

      {/* 4. Current-month context, matching the company's own dashboard */}
      <SACard>
        <SACardHeader
          title="This month"
          subtitle="Same figures as the company's own dashboard, scoped to this calendar month."
        />
        <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Revenue</p>
            <p className="mt-1 text-lg font-bold text-emerald-600 tabular-nums">
              {formatCurrency(finance.thisMonth.revenue)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Expenses</p>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              {formatCurrency(finance.thisMonth.expense)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Company admins</p>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              {formatCount(counts.companyAdmins)}
            </p>
          </div>
        </div>
      </SACard>

      {successMsg && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {successMsg}
        </div>
      )}

      {/* Subscription */}
      <CompanySubscriptionCard
        company={company}
        subscription={data.subscription}
        onAssign={() => setAssignOpen(true)}
        statusAction={
          company.status === "PENDING_PAYMENT" ? (
            <SAButton
              variant="danger"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              disabled={actionBusy}
            >
              Delete pending company
            </SAButton>
          ) : company.status === "ACTIVE" || company.status === "SUSPENDED" ? (
            <SAButton
              variant="secondary"
              size="sm"
              onClick={() => setStatusOpen(true)}
              disabled={actionBusy}
            >
              {company.status === "ACTIVE" ? "Deactivate" : "Activate"}
            </SAButton>
          ) : null
        }
      />

      {/* Subscription history */}
      <CompanySubscriptionHistoryCard history={data.subscriptionHistory} />

      <CompanyStatusModal
        open={statusOpen}
        company={company}
        onClose={() => {
          setStatusOpen(false);
          setStatusError("");
        }}
        onConfirm={handleStatusConfirm}
        saving={actionBusy}
        error={statusError}
      />

      {assignOpen && (
        <AssignPlanModal
          isOpen
          company={{ ...company, subscription: data.subscription }}
          onClose={() => setAssignOpen(false)}
          onSuccess={retry}
        />
      )}

      <DeletePendingModal
        open={deleteOpen}
        company={company}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteError("");
        }}
        onConfirm={handleDeleteConfirm}
        saving={actionBusy}
        error={deleteError}
      />
    </div>
  );
}
