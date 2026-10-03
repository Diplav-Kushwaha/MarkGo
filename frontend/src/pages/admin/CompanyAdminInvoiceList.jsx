import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteInvoice,
  duplicateInvoice,
  getInvoiceSummary,
  getInvoices,
} from "../../api/invoiceAdminApi";
import { formatCurrency, formatDate } from "../../lib/format";
import InvoiceStatusBadge from "../../components/invoices/InvoiceStatusBadge";
import InvoiceSummaryCards from "../../components/invoices/InvoiceSummaryCards";
import ConfirmActionModal from "../../components/invoices/ConfirmActionModal";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  RowActions,
} from "../../components/ui";

const PAGE_SIZE = 10;

export default function CompanyAdminInvoiceList({ onCreateNew, onViewDetail, onEdit }) {
  // Filters (and the page) live in the URL so a filtered list can be shared or
  // reloaded without losing context.
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const page = Number(searchParams.get("page") || 1);

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const goToPage = (next) => updateFilter("page", String(next));

  const reload = () => setReloadToken((token) => token + 1);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const params = Object.fromEntries(searchParams.entries());

      try {
        const [listRes, summaryRes] = await Promise.all([getInvoices(params), getInvoiceSummary()]);
        if (cancelled) return;

        if (listRes.success) {
          setInvoices(listRes.data.invoices || []);
          setPagination({
            total: listRes.data.pagination?.total ?? 0,
            page: listRes.data.pagination?.page ?? page,
            pageSize: listRes.data.pagination?.pageSize ?? PAGE_SIZE,
            totalPages: listRes.data.pagination?.totalPages ?? 1,
          });
        }
        if (summaryRes.success) setSummary(summaryRes.data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load invoices.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [searchParams, reloadToken, page]);

  const handleDelete = async () => {
    try {
      await deleteInvoice(deleteId);
      setNotice("Invoice deleted.");
      reload();
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to delete invoice.");
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await duplicateInvoice(id);
      if (res.success) onViewDetail(res.data.id);
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to duplicate invoice.");
    }
  };

  const columns = [
    {
      key: "invoiceNumber",
      header: "Invoice",
      width: "16%",
      render: (row) => <span className="font-medium text-ink">{row.invoiceNumber}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <div>
          <div className="text-body">{row.customer?.name || "—"}</div>
          <div className="text-xs text-muted">{row.customer?.email}</div>
        </div>
      ),
    },
    {
      key: "invoiceDate",
      header: "Issue date",
      render: (row) => formatDate(row.invoiceDate),
    },
    {
      key: "dueDate",
      header: "Due date",
      render: (row) => formatDate(row.dueDate),
    },
    { key: "status", header: "Status", render: (row) => <InvoiceStatusBadge status={row.status} /> },
    {
      key: "grandTotal",
      header: "Grand total",
      align: "right",
      render: (row) => <span className="font-medium text-ink">{formatCurrency(row.grandTotal)}</span>,
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
      render: (row) => (
        <RowActions
          label={`Actions for ${row.invoiceNumber}`}
          actions={[
            { label: "View invoice", icon: FileText, onSelect: () => onViewDetail(row.id) },
            {
              label: "Edit",
              icon: Pencil,
              tone: "primary",
              hidden: row.status !== "DRAFT",
              onSelect: () => onEdit(row.id),
            },
            { label: "Duplicate", icon: Copy, onSelect: () => handleDuplicate(row.id) },
            {
              label: "Delete",
              icon: Trash2,
              tone: "danger",
              hidden: row.status !== "DRAFT",
              onSelect: () => setDeleteId(row.id),
            },
          ]}
        />
      ),
    },
  ];

  const hasFilters = Boolean(
    searchParams.get("search") ||
      searchParams.get("status") ||
      searchParams.get("from") ||
      searchParams.get("overdue")
  );

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Manage customer billing, track payments and monitor aging receivables."
        actions={
          <Button onClick={onCreateNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New invoice
          </Button>
        }
      />

      {(error || notice) && (
        <Alert className="mb-4" tone={error ? "error" : "success"} title={error ? "Could not load invoices" : undefined}>
          {error || notice}
        </Alert>
      )}

      <div className="space-y-4">
        <InvoiceSummaryCards summary={summary} />

        <Card className="p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateFilter("search", e.target.elements.search.value.trim());
            }}
            className="flex flex-wrap items-center gap-3"
          >
            <input
              type="search"
              name="search"
              defaultValue={searchParams.get("search") || ""}
              placeholder="Search by invoice number, customer or notes…"
              className="h-9 min-w-64 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors placeholder:text-muted focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            />

            <select
              value={searchParams.get("status") || ""}
              onChange={(e) => updateFilter("status", e.target.value)}
              aria-label="Filter by status"
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-body focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <input
              type="date"
              value={searchParams.get("from") || ""}
              onChange={(e) => updateFilter("from", e.target.value)}
              aria-label="Issued from"
              title="Issued from"
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-body focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            />

            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-body">
              <input
                type="checkbox"
                checked={searchParams.get("overdue") === "true"}
                onChange={(e) => updateFilter("overdue", e.target.checked ? "true" : "")}
                className="h-4 w-4 rounded border-line-strong text-primary-600 focus:ring-2 focus:ring-primary-600/30"
              />
              Overdue only
            </label>

            {hasFilters && (
              <button
                type="button"
                onClick={() => setSearchParams({}, { replace: true })}
                className="h-9 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-slate-100 hover:text-ink"
              >
                Reset
              </button>
            )}
          </form>
        </Card>

        <Card>
          <DataTable
            contained
            columns={columns}
            rows={invoices}
            loading={loading}
            onRowClick={(row) => onViewDetail(row.id)}
            empty={
              <EmptyState
                icon={FileText}
                title={hasFilters ? "No invoices match these filters" : "No invoices yet"}
                description={
                  hasFilters
                    ? "Try a different search term or clear the filters."
                    : "Create your first invoice to start tracking receivables."
                }
                action={
                  <Button onClick={onCreateNew}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New invoice
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
          onPageChange={goToPage}
        />
      </div>

      <ConfirmActionModal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete invoice"
        message="Are you sure you want to delete this draft invoice? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="red"
      />
    </>
  );
}
