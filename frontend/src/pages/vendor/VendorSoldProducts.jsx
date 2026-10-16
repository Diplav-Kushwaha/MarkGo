import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { getSoldProducts } from "../../api/vendorDashboardApi";
import { formatCurrency, formatDate } from "../../lib/format";
import {
  Card,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
  Pagination,
  StatusBadge,
} from "../../components/ui";
import useDirectoryList from "../../components/admin/useDirectoryList";
import CustomerListToolbar from "../../components/customer/CustomerListToolbar";

/**
 * Vendor "Sold Products & Services" — a read-only summary built from the
 * vendor's own bill line items, so it only ever contains what this vendor has
 * supplied to the company. No Add/Edit/Delete or any other action exists here.
 */

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "product", label: "Product" },
  { value: "service", label: "Service" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "az", label: "Name (A-Z)" },
  { value: "quantity", label: "Quantity: high to low" },
];

const INITIAL_QUERY = { search: "", type: "", sort: "recent", page: 1, pageSize: 10 };

async function fetchPage(params) {
  const res = await getSoldProducts({
    search: params.search,
    type: params.type,
    sort: params.sort,
    page: params.page,
    limit: params.pageSize,
  });
  if (!res.success || !res.data) return null;
  return { rows: res.data.items || [], ...(res.data.pagination || {}) };
}

function TypeBadge({ type }) {
  if (type !== "PRODUCT" && type !== "SERVICE") return <span className="text-muted">—</span>;
  const isProduct = type === "PRODUCT";
  return <StatusBadge status={isProduct ? "PRODUCT" : "SERVICE"} label={isProduct ? "Product" : "Service"} tone={isProduct ? "primary" : "info"} />;
}

function DetailRow({ row }) {
  return (
    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <Detail label="Name" value={row.name} />
      <Detail label="Type" value={row.type === "PRODUCT" ? "Product" : row.type === "SERVICE" ? "Service" : null} />
      <Detail label="Code" value={row.productCode} />
      <Detail label="Unit" value={row.unit} />
      <Detail label="Total quantity supplied" value={row.totalQuantity} />
      <Detail label="Number of bills" value={row.billCount} />
      <Detail label="First supply" value={formatDate(row.firstSupplyDate)} />
      <Detail label="Last supply" value={formatDate(row.lastSupplyDate)} />
      <Detail label="Last bill" value={row.lastBillNumber} />
      <Detail label="Last unit price" value={formatCurrency(row.lastUnitPrice)} />
      <Detail label="Average unit price" value={formatCurrency(row.averageUnitPrice)} />
    </dl>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-tile border border-primary-100 bg-primary-50/50 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value === null || value === undefined || value === "" ? "-" : value}</dd>
    </div>
  );
}

export default function VendorSoldProducts() {
  const [viewing, setViewing] = useState(null);

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

  const hasFilters = Boolean(query.search) || Boolean(query.type) || query.sort !== INITIAL_QUERY.sort;

  const columns = [
    {
      key: "name",
      header: "Product / service",
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-ink">{row.name}</span>
          <TypeBadge type={row.type} />
        </div>
      ),
    },
    {
      key: "productCode",
      header: "Code",
      render: (row) => (row.productCode ? <span className="text-body">{row.productCode}</span> : <span className="text-muted">—</span>),
    },
    {
      key: "unit",
      header: "Unit",
      render: (row) => (row.unit ? <span className="text-body">{row.unit}</span> : <span className="text-muted">—</span>),
    },
    {
      key: "totalQuantity",
      header: "Qty supplied",
      align: "right",
      render: (row) => <span className="font-medium text-ink">{row.totalQuantity}</span>,
    },
    {
      key: "billCount",
      header: "Bills",
      align: "right",
      render: (row) => <span className="text-body">{row.billCount}</span>,
    },
    {
      key: "lastSupplyDate",
      header: "Last supply",
      render: (row) => <span className="text-body">{formatDate(row.lastSupplyDate)}</span>,
    },
    {
      key: "lastUnitPrice",
      header: "Last unit price",
      align: "right",
      render: (row) => <span className="text-body">{formatCurrency(row.lastUnitPrice)}</span>,
    },
    {
      key: "averageUnitPrice",
      header: "Avg. unit price",
      align: "right",
      render: (row) => <span className="text-body">{formatCurrency(row.averageUnitPrice)}</span>,
    },
  ];

  return (
    <>
      <PageHeader title="Sold Products & Services" subtitle="A read-only summary of what you have supplied, taken from your own bills." />

      <div className="space-y-5">
        {error && <div className="rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">{error}</div>}

        <CustomerListToolbar
          searchValue={query.search}
          onSearchChange={(value) => setFilter("search", value)}
          searchPlaceholder="Search by product or code…"
          filters={[
            { key: "type", value: query.type, onChange: (value) => setFilter("type", value), options: TYPE_OPTIONS, placeholder: "All types", ariaLabel: "Type" },
            { key: "sort", value: query.sort, onChange: (value) => setFilter("sort", value), options: SORT_OPTIONS, placeholder: "Sort", ariaLabel: "Sort" },
          ]}
          onReset={resetFilters}
          hasFilters={hasFilters}
        />

        <Card>
          <DataTable
            contained
            columns={columns}
            rows={rows}
            loading={loading}
            onRowClick={(row) => setViewing(row)}
            empty={
              <EmptyState
                icon={ShoppingBag}
                title={hasFilters ? "No products or services match these filters" : "No bills yet"}
                description={hasFilters ? "Try a different search term or type filter." : "Products and services you supply will appear here once you are billed for them."}
              />
            }
          />
        </Card>

        <Pagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {viewing && (
        <Modal isOpen onClose={() => setViewing(null)} title="Supplied product / service" description="Read-only summary">
          <DetailRow row={viewing} />
        </Modal>
      )}
    </>
  );
}
