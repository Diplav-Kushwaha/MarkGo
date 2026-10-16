import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { getVendorBills } from "../../api/vendorDashboardApi";
import { formatCurrency, formatDate } from "../../lib/format";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  StatusBadge,
} from "../../components/ui";
import useDirectoryList from "../../components/admin/useDirectoryList";
import CustomerListToolbar from "../../components/customer/CustomerListToolbar";

/**
 * Vendor "Bills" — a read-only list of the vendor's own bills only. "View" opens
 * a read-only, printable bill page. No create/edit/pay/approve actions.
 */

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "PAID", label: "Paid" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amountHigh", label: "Amount: high to low" },
  { value: "amountLow", label: "Amount: low to high" },
];

const INITIAL_QUERY = { search: "", status: "", from: "", to: "", sort: "newest", page: 1, pageSize: 10 };

async function fetchPage(params) {
  const res = await getVendorBills({
    search: params.search,
    status: params.status,
    from: params.from,
    to: params.to,
    sort: params.sort,
    page: params.page,
    limit: params.pageSize,
  });
  if (!res.success || !res.data) return null;
  return { rows: res.data.bills || [], ...(res.data.pagination || {}) };
}

export default function VendorBills() {
  const navigate = useNavigate();

  const {
    query,
    rows,
    pagination,
    loading,
    error,
    setFilter,
    setPage,
    setPageSize,
    resetFilters,
  } = useDirectoryList({ fetchPage, fetchStats: () => Promise.resolve(null), initialQuery: INITIAL_QUERY });

  const hasFilters =
    Boolean(query.search) || Boolean(query.status) || Boolean(query.from) || Boolean(query.to) || query.sort !== INITIAL_QUERY.sort;

  const columns = [
    {
      key: "billNumber",
      header: "Bill #",
      render: (row) => <span className="font-medium text-ink">{row.billNumber}</span>,
    },
    {
      key: "billDate",
      header: "Date",
      render: (row) => <span className="text-body">{formatDate(row.billDate)}</span>,
    },
    {
      key: "dueDate",
      header: "Due date",
      render: (row) => (row.dueDate ? <span className="text-body">{formatDate(row.dueDate)}</span> : <span className="text-muted">—</span>),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => <span className="font-medium text-ink">{formatCurrency(row.total, row.currency)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} dot />,
    },
    {
      key: "itemCount",
      header: "Items",
      align: "right",
      render: (row) => <span className="text-body">{row.itemCount}</span>,
    },
    {
      key: "actions",
      header: "",
      width: "84px",
      align: "right",
      render: (row) => (
        <Button variant="secondary" size="sm" onClick={() => navigate(`/vendor/dashboard/bills/${row.id}`)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Bills" subtitle="A read-only list of the bills raised to you." />

      <div className="space-y-5">
        {error && <div className="rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">{error}</div>}

        <CustomerListToolbar
          searchValue={query.search}
          onSearchChange={(value) => setFilter("search", value)}
          searchPlaceholder="Search by bill number…"
          filters={[
            { key: "status", value: query.status, onChange: (value) => setFilter("status", value), options: STATUS_OPTIONS, placeholder: "All statuses", ariaLabel: "Status" },
            { key: "sort", value: query.sort, onChange: (value) => setFilter("sort", value), options: SORT_OPTIONS, placeholder: "Sort", ariaLabel: "Sort" },
          ]}
          onReset={resetFilters}
          hasFilters={hasFilters}
        />

        <div className="mb-4 flex flex-col gap-3 rounded-card border border-primary-100/70 bg-white/95 p-4 shadow-card sm:flex-row sm:items-center">
          <Input type="date" aria-label="From date" value={query.from || ""} onChange={(event) => setFilter("from", event.target.value)} containerClassName="sm:w-44" />
          <Input type="date" aria-label="To date" value={query.to || ""} onChange={(event) => setFilter("to", event.target.value)} containerClassName="sm:w-44" />
        </div>

        <Card>
          <DataTable
            contained
            columns={columns}
            rows={rows}
            loading={loading}
            empty={
              <EmptyState
                icon={FileText}
                title={hasFilters ? "No bills match these filters" : "No bills yet"}
                description={hasFilters ? "Try a different search term or date range." : "Bills raised to you will appear here."}
              />
            }
          />
        </Card>

        <Pagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </>
  );
}
