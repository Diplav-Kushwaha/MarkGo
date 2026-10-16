import { useRef, useState } from "react";
import { Package } from "lucide-react";
import { getCustomerProducts } from "../../api/customerDashboardApi";
import { formatCurrency } from "../../lib/format";
import { TAX_MODE_LABELS } from "../../lib/serviceConstants";
import { Card, DataTable, EmptyState, PageHeader, Pagination, StatusBadge } from "../../components/ui";
import useDirectoryList from "../../components/admin/useDirectoryList";
import CustomerListToolbar from "../../components/customer/CustomerListToolbar";

/**
 * Customer "Products" — a read-only catalogue of the customer's own company.
 * Shows only customer-safe fields (no purchase price, cost or exact stock).
 * No Add/Edit/Delete or any other action exists here.
 */

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "Name (A-Z)" },
  { value: "za", label: "Name (Z-A)" },
  { value: "priceHigh", label: "Price: high to low" },
  { value: "priceLow", label: "Price: low to high" },
];

const AVAILABILITY_OPTIONS = [
  { value: "", label: "All availability" },
  { value: "available", label: "Available" },
  { value: "notavailable", label: "Not available" },
];

const INITIAL_QUERY = { search: "", category: "", availability: "", sort: "newest", page: 1, pageSize: 10 };

async function fetchProducts(params, setCategories) {
  const res = await getCustomerProducts({
    search: params.search,
    category: params.category,
    availability: params.availability,
    sort: params.sort,
    page: params.page,
    limit: params.pageSize,
  });
  if (!res.success || !res.data) return null;
  setCategories(res.data.categories || []);
  return { rows: res.data.items || [], ...(res.data.pagination || {}) };
}

export default function CustomerProducts() {
  const [categories, setCategories] = useState([]);
  const categoriesLoaded = useRef(false);

  const setCategoriesOnce = (values) => {
    if (categoriesLoaded.current) return;
    categoriesLoaded.current = true;
    setCategories(values);
  };

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
  } = useDirectoryList({
    fetchPage: (params) => fetchProducts(params, setCategoriesOnce),
    fetchStats: () => Promise.resolve(null),
    initialQuery: INITIAL_QUERY,
  });

  const categoryOptions = [{ value: "", label: "All categories" }, ...categories.map((name) => ({ value: name, label: name }))];
  const hasFilters = Boolean(query.search) || Boolean(query.category) || Boolean(query.availability) || query.sort !== INITIAL_QUERY.sort;

  const columns = [
    { key: "name", header: "Product", render: (row) => <span className="font-medium text-ink">{row.name}</span> },
    {
      key: "productCode",
      header: "Code",
      render: (row) => (row.productCode ? <span className="text-body">{row.productCode}</span> : <span className="text-muted">—</span>),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => (row.category ? <span className="text-body">{row.category}</span> : <span className="text-muted">—</span>),
    },
    {
      key: "unit",
      header: "Unit",
      render: (row) => (row.unit ? <span className="text-body">{row.unit}</span> : <span className="text-muted">—</span>),
    },
    {
      key: "brand",
      header: "Brand",
      render: (row) => (row.brand ? <span className="text-body">{row.brand}</span> : <span className="text-muted">—</span>),
    },
    {
      key: "sellingPrice",
      header: "Price",
      align: "right",
      render: (row) => (
        <>
          <span className="font-medium text-ink">{formatCurrency(row.sellingPrice)}</span>
          <span className="ml-1 text-xs font-normal text-muted">{TAX_MODE_LABELS[row.sellingPriceTaxMode] || "no tax"}</span>
        </>
      ),
    },
    {
      key: "availability",
      header: "Availability",
      render: (row) => <StatusBadge status={row.availability === "Available" ? "ACTIVE" : "INACTIVE"} label={row.availability} dot />,
    },
    {
      key: "stockStatus",
      header: "Stock",
      render: (row) =>
        row.stockStatus ? (
          <span className={row.inStock ? "text-success" : "text-danger"}>{row.stockStatus}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Products" subtitle="A read-only catalogue of products from your company." />

      <div className="space-y-5">
        {error && <div className="rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">{error}</div>}

        <CustomerListToolbar
          searchValue={query.search}
          onSearchChange={(value) => setFilter("search", value)}
          searchPlaceholder="Search by product, code or brand…"
          filters={[
            { key: "category", value: query.category, onChange: (value) => setFilter("category", value), options: categoryOptions, placeholder: "All categories", ariaLabel: "Category" },
            { key: "availability", value: query.availability, onChange: (value) => setFilter("availability", value), options: AVAILABILITY_OPTIONS, placeholder: "All availability", ariaLabel: "Availability" },
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
            empty={
              <EmptyState
                icon={Package}
                title={hasFilters ? "No products match these filters" : "No products yet"}
                description={hasFilters ? "Try a different search term or filter." : "Your company's products will appear here."}
              />
            }
          />
        </Card>

        <Pagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </>
  );
}
