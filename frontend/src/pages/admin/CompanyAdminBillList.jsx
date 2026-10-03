import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Eye, FileText, Pencil, Plus, Receipt, Wallet } from "lucide-react";
import { getBills, getBillSummary } from "../../api/billAdminApi";
import { getVendors } from "../../api/vendorAdminApi";
import BillStatusBadge from "../../components/bills/BillStatusBadge";
import { formatCurrency, formatDate, humanize } from "../../lib/format";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  RowActions,
  SkeletonStatCards,
  StatCard,
} from "../../components/ui";

const PAGE_SIZE = 10;

const CATEGORY_OPTIONS = [
  "OFFICE",
  "TRAVEL",
  "RENT",
  "UTILITIES",
  "SUPPLIES",
  "SERVICES",
  "SOFTWARE",
  "TAXES",
  "OTHER",
];

const EMPTY_SUMMARY = {
  totalBilled: 0,
  totalPaid: 0,
  totalOutstanding: 0,
  unpaidCount: 0,
  unpaidAmount: 0,
};

export default function CompanyAdminBillList({ onCreateNew, onViewDetail, onEdit }) {
  // Filters live in the URL, as they do on the invoices list.
  const [searchParams, setSearchParams] = useSearchParams();

  const [bills, setBills] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const updateFilter = (key, value, keepPage = false) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (!keepPage) next.delete("page");
    setError("");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let active = true;
    const params = Object.fromEntries(searchParams.entries());

    Promise.all([getBills({ pageSize: PAGE_SIZE, ...params }), getBillSummary()])
      .then(([listRes, summaryRes]) => {
        if (!active) return;
        if (listRes.success) {
          setBills(listRes.data.bills || []);
          if (listRes.data.pagination) setPagination(listRes.data.pagination);
        }
        if (summaryRes.success) setSummary({ ...EMPTY_SUMMARY, ...summaryRes.data });
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Failed to load bills.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    getVendors({ pageSize: 100 })
      .then((res) => {
        if (active && res.success) setVendors(res.data.vendors || []);
      })
      .catch(() => {
        if (active) setVendors([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateSearch = useCallback(
    (value) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set("search", value);
      else next.delete("search");
      next.delete("page");
      setError("");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput === (searchParams.get("search") || "")) return;
      updateSearch(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, searchParams, updateSearch]);

  const statCards = [
    {
      label: "Total billed",
      value: formatCurrency(summary.totalBilled),
      hint: "Across all vendor bills",
      icon: Receipt,
      tone: "primary",
    },
    {
      label: "Total paid",
      value: formatCurrency(summary.totalPaid),
      hint: "Payments made to vendors",
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Total outstanding",
      value: formatCurrency(summary.totalOutstanding),
      hint: "Still owed to vendors",
      icon: Wallet,
      tone: "warning",
    },
    {
      label: "Unpaid bills",
      value: summary.unpaidCount || 0,
      hint: formatCurrency(summary.unpaidAmount),
      icon: Clock,
      tone: "danger",
    },
  ];

  const columns = [
    {
      key: "billNumber",
      header: "Bill",
      width: "16%",
      render: (row) => <span className="font-medium text-ink">{row.billNumber}</span>,
    },
    {
      key: "vendor",
      header: "Vendor",
      render: (row) => row.vendor?.name || <span className="text-muted">—</span>,
    },
    {
      key: "billDate",
      header: "Bill date",
      render: (row) => formatDate(row.billDate),
    },
    {
      key: "dueDate",
      header: "Due date",
      render: (row) => formatDate(row.dueDate),
    },
    {
      key: "category",
      header: "Category",
      render: (row) =>
        row.category ? (
          <span className="text-body">{humanize(row.category)}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: "status", header: "Status", render: (row) => <BillStatusBadge status={row.status} /> },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => <span className="font-medium text-ink">{formatCurrency(row.total)}</span>,
    },
    {
      key: "amountDue",
      header: "Amount due",
      align: "right",
      render: (row) => (
        <span className={Number(row.amountDue) > 0 ? "font-medium text-danger" : "text-muted"}>
          {formatCurrency(row.amountDue)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "72px",
      align: "right",
      render: (row) => {
        // A bill with payments recorded against it can no longer be edited.
        const editable = row.status === "UNPAID" && !row.amountPaid;
        return (
          <RowActions
            label={`Actions for ${row.billNumber}`}
            actions={[
              { label: "View bill", icon: Eye, onSelect: () => onViewDetail(row.id) },
              {
                label: "Edit bill",
                icon: Pencil,
                tone: "primary",
                hidden: !editable,
                onSelect: () => onEdit(row.id),
              },
            ]}
          />
        );
      },
    },
  ];

  const hasFilters = ["search", "status", "vendorId", "category", "from", "to"].some((key) =>
    searchParams.get(key)
  );

  return (
    <>
      <PageHeader
        title="Bills"
        subtitle="Record vendor bills, log outgoing payments, and track what you owe."
        actions={
          <Button onClick={onCreateNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New bill
          </Button>
        }
      />

      {error && (
        <Alert className="mb-4" tone="error" title="Could not load bills">
          {error}
        </Alert>
      )}

      <div className="space-y-4">
        {loading ? (
          <SkeletonStatCards count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                hint={card.hint}
                icon={card.icon}
                tone={card.tone}
              />
            ))}
          </div>
        )}

        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by bill number or vendor…"
              aria-label="Search bills"
              className="h-9 min-w-64 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors placeholder:text-muted focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            />

            <select
              value={searchParams.get("status") || ""}
              onChange={(e) => updateFilter("status", e.target.value)}
              aria-label="Filter by status"
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-body focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            >
              <option value="">All statuses</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
            </select>

            <select
              value={searchParams.get("vendorId") || ""}
              onChange={(e) => updateFilter("vendorId", e.target.value)}
              aria-label="Filter by vendor"
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-body focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            >
              <option value="">All vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>

            <select
              value={searchParams.get("category") || ""}
              onChange={(e) => updateFilter("category", e.target.value)}
              aria-label="Filter by category"
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-body focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {humanize(category)}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={searchParams.get("from") || ""}
              onChange={(e) => updateFilter("from", e.target.value)}
              aria-label="Bills from"
              title="Bills from"
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-body focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            />

            <input
              type="date"
              value={searchParams.get("to") || ""}
              onChange={(e) => updateFilter("to", e.target.value)}
              aria-label="Bills to"
              title="Bills to"
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-body focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            />

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setError("");
                  setSearchParams({}, { replace: true });
                }}
                className="h-9 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-slate-100 hover:text-ink"
              >
                Reset
              </button>
            )}
          </div>
        </Card>

        <Card>
          <DataTable
            contained
            columns={columns}
            rows={bills}
            loading={loading}
            onRowClick={(row) => onViewDetail(row.id)}
            empty={
              <EmptyState
                icon={FileText}
                title={hasFilters ? "No bills match these filters" : "No bills yet"}
                description={
                  hasFilters
                    ? "Try widening the date range or clearing the filters."
                    : "Record your first vendor bill to start tracking payables."
                }
                action={
                  <Button onClick={onCreateNew}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New bill
                  </Button>
                }
              />
            }
          />
        </Card>

        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={(next) => updateFilter("page", String(next), true)}
        />
      </div>
    </>
  );
}
