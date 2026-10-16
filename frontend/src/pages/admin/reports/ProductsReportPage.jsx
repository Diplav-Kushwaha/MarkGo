import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { getCategoryOptions } from "../../../api/categoryAdminApi";
import { getProductsReport } from "../../../api/reportAdminApi";
import { formatCurrency } from "../../../lib/format";
import {
  AVAILABILITY_LABELS,
  CATALOGUE_SORT_OPTIONS,
  CATALOGUE_STATUS_FILTERS,
  STOCK_FILTERS,
  TAX_MODE_LABELS,
} from "../../../lib/reportConstants";
import { LOW_STOCK_THRESHOLD } from "../../../lib/productConstants";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
  StatusBadge,
} from "../../../components/ui";
import ReportFilterBar, { ReportNote, ReportTable, SummaryCardsSkeleton } from "../../../components/admin/reportFilterBar";
import useReportData from "../../../components/admin/useReportData";

/**
 * 9. ALL PRODUCTS
 *
 * The catalogue as stock and value: what each product sells for, what it cost,
 * how much is on hand, and what that stock is worth.
 *
 * Stock value is the selling price on hand. Cost value is the purchase price on
 * hand, and exists only where a purchase price is recorded — a product without
 * one is reported with a null cost value rather than a zero, so the total cost
 * never looks complete when it is not.
 *
 * These figures describe the catalogue today, not a historical period: a
 * product's selling price and quantity are its current values.
 */

const PAGE_SIZE = 10;

const EMPTY_SUMMARY = {
  totalProducts: 0,
  availableProducts: 0,
  lowStockProducts: 0,
  totalSellingValue: 0,
  totalCostValue: 0,
};

const NOT_AVAILABLE = <span className="text-muted">Not available</span>;

/** Stock hint beside the quantity, matching the Products page's wording. */
function StockHint({ isOutOfStock, isLowStock }) {
  if (isOutOfStock) {
    return (
      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-danger-line">
        Out of stock
      </span>
    );
  }
  if (isLowStock) {
    return (
      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-warning-line">
        Low stock
      </span>
    );
  }
  return <span className="text-xs text-muted">In stock</span>;
}

export default function ProductsReportPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [stock, setStock] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let cancelled = false;

    getCategoryOptions()
      .then((response) => {
        if (cancelled) return;
        const list = response?.success ? response.data || [] : [];
        setCategories(list.filter((entry) => entry.type === "PRODUCT"));
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const query = useMemo(
    () => ({
      search: search.trim() || undefined,
      category: category || undefined,
      status: status || undefined,
      stock: stock || undefined,
      sort,
      page,
      pageSize,
    }),
    [search, category, status, stock, sort, page, pageSize]
  );

  const { data, loading, error } = useReportData({ fetcher: getProductsReport, query });

  const rows = data?.rows || [];
  const summary = { ...EMPTY_SUMMARY, ...(data?.summary || {}) };
  const pagination = data?.pagination || { total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All categories" },
      ...categories.map((entry) => ({ value: entry.id, label: entry.name })),
    ],
    [categories]
  );

  const summaryCards = [
    {
      label: "Total products",
      value: String(summary.totalProducts || 0),
      hint: "Matching these filters",
      icon: Package,
      tone: "primary",
    },
    {
      label: "Available",
      value: String(summary.availableProducts || 0),
      hint: "Currently offered for sale",
      icon: Boxes,
      tone: "success",
    },
    {
      label: "Low stock",
      value: String(summary.lowStockProducts || 0),
      hint: `Quantity of 1 to ${LOW_STOCK_THRESHOLD}`,
      icon: AlertTriangle,
      tone: "warning",
    },
    {
      label: "Total selling value",
      value: formatCurrency(summary.totalSellingValue),
      hint: "Selling price x quantity on hand",
      icon: TrendingUp,
      tone: "info",
    },
    {
      label: "Total cost value",
      value: summary.totalCostValue === null ? NOT_AVAILABLE : formatCurrency(summary.totalCostValue),
      hint: "Purchase price x quantity on hand",
      icon: Wallet,
      tone: "muted",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Product",
      render: (row) => <span className="font-medium text-ink">{row.name}</span>,
    },
    { key: "productCode", header: "Code", render: (row) => row.productCode || <span className="text-muted">—</span> },
    { key: "category", header: "Category", render: (row) => row.category || <span className="text-muted">—</span> },
    { key: "unit", header: "Unit", render: (row) => row.unit || <span className="text-muted">—</span> },
    {
      key: "sellingPrice",
      header: "Selling price",
      align: "right",
      render: (row) => (
        <div>
          <span className="font-medium text-ink">{formatCurrency(row.sellingPrice)}</span>
          <span className="ml-1 text-xs font-normal text-muted">
            {TAX_MODE_LABELS[row.sellingPriceTaxMode] || "no tax"}
          </span>
        </div>
      ),
    },
    {
      key: "purchasePrice",
      header: "Purchase price",
      align: "right",
      render: (row) =>
        row.purchasePrice === null ? (
          <span className="text-muted">Not recorded</span>
        ) : (
          formatCurrency(row.purchasePrice)
        ),
    },
    {
      key: "quantity",
      header: "Quantity",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <span className="text-body">{row.quantity}</span>
          <StockHint
            quantity={row.quantity}
            isOutOfStock={row.isOutOfStock}
            isLowStock={row.isLowStock}
          />
        </div>
      ),
    },
    {
      key: "stockValue",
      header: "Stock value",
      align: "right",
      render: (row) => formatCurrency(row.stockValue),
    },
    {
      key: "costValue",
      header: "Cost value",
      align: "right",
      render: (row) =>
        row.costValue === null ? <span className="text-muted">Not available</span> : formatCurrency(row.costValue),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge
          status={row.status}
          label={AVAILABILITY_LABELS[row.status] || row.status}
          dot
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="All products"
        subtitle="The catalogue as stock and value: selling price, purchase price, quantity on hand and what that stock is worth."
      />


      <div className="space-y-5">
        <ReportNote
          title="What this report covers"
          items={[
            "These are the catalogue's current values — a product's selling price and quantity today, not a historical period.",
            "Stock value is the selling price on hand; cost value is the purchase price on hand, and only exists where a purchase price is recorded.",
            `A product with a quantity of 1 to ${LOW_STOCK_THRESHOLD} is low stock; 0 is out of stock.`,
          ]}
        />

        <ReportFilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search by name or code—…"
          searchLabel="Search products"
          fields={[
            {
              key: "category",
              label: "Category",
              value: category,
              onChange: (value) => {
                setCategory(value);
                setPage(1);
              },
              options: categoryOptions,
              width: "w-48",
            },
            {
              key: "status",
              label: "Status",
              value: status,
              onChange: (value) => {
                setStatus(value);
                setPage(1);
              },
              options: CATALOGUE_STATUS_FILTERS,
              width: "w-44",
            },
            {
              key: "stock",
              label: "Stock",
              value: stock,
              onChange: (value) => {
                setStock(value);
                setPage(1);
              },
              options: STOCK_FILTERS,
              width: "w-44",
            },
            {
              key: "sort",
              label: "Sort",
              value: sort,
              onChange: (value) => {
                setSort(value);
                setPage(1);
              },
              options: CATALOGUE_SORT_OPTIONS,
              width: "w-52",
            },
          ]}
          onReset={() => {
            setSearch("");
            setCategory("");
            setStatus("");
            setStock("");
            setSort("newest");
            setPage(1);
          }}
        />

        {error && (
          <ReportNote tone="error" title="This report could not be loaded" items={[error]} />
        )}

        {loading ? (
          <SummaryCardsSkeleton count={5} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
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

        <Card>
          <CardHeader
            title="Products"
            description="The summary cards describe the filtered set, so they move with the filters."
          />
          <ReportTable
            columns={columns}
            rows={rows}
            loading={loading}
            empty={
              <EmptyState
                icon={Package}
                title="No products match these filters"
                description="Try a different search term, category, status or stock level."
              />
            }
          />
        </Card>

        {pagination.total > 0 && (
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        )}
      </div>
    </>
  );
}
