import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  FileText,
  Package,
  Receipt,
  Search,
  Wallet,
} from "lucide-react";
import {
  getSoldItemLines,
  getSoldProductsReport,
} from "../../../api/reportAdminApi";
import { formatCurrency, formatDate } from "../../../lib/format";
import { ITEM_PROFIT_SORT_OPTIONS, presetRange } from "../../../lib/reportConstants";
import {
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  StatCard,
} from "../../../components/ui";
import ReportFilterBar, { ReportNote, ReportTable, SummaryCardsSkeleton, } from "../../../components/admin/reportFilterBar";
import useReportData from "../../../components/admin/useReportData";

/**
 * 5. PRODUCT-WISE PROFIT & LOSS
 *
 * The selector lists only products that have actually been sold — one row per
 * product that appears on at least one invoice line. Selecting one shows its
 * overall profit or loss, and the table of invoices it was sold on.
 *
 * The cost rule is the same as the Profit & Loss report: the cost recorded at the
 * time of sale does not exist on an invoice line, so the product's CURRENT
 * purchase price is used, excluding tax per its tax mode. A product with no
 * purchase price is reported as cost-not-available rather than as zero cost.
 *
 * The ranked table underneath lists every sold product's profit so the selector
 * can be used or bypassed.
 */

const PAGE_SIZE = 10;
const LINES_PAGE_SIZE = 10;

const EMPTY_SUMMARY = {
  soldItemCount: 0,
  unitsSold: 0,
  revenue: 0,
  taxCollected: 0,
  invoiceCount: 0,
  unknownLineCount: 0,
};

const EMPTY_SELECTED = {
  unitsSold: 0,
  revenue: 0,
  taxCollected: 0,
  cost: null,
  profit: null,
  marginPercent: null,
  averageSellingPrice: null,
  invoiceCount: 0,
  firstSaleDate: null,
  lastSaleDate: null,
  costKnown: false,
  name: "Unknown product",
  code: null,
  category: null,
};

const NOT_AVAILABLE = <span className="text-muted">Not available</span>;

export default function SoldProductsReportPage() {
  const [range, setRange] = useState({ preset: "month", ...presetRange("month") });
  const [productId, setProductId] = useState("");
  const [search, setSearch] = useState("");
  const [selectorSearch, setSelectorSearch] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [sort, setSort] = useState("profitDesc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const query = useMemo(
    () => ({
      from: range.from || undefined,
      to: range.to || undefined,
      productId: productId || undefined,
      sort,
      page,
      pageSize,
    }),
    [range, productId, sort, page, pageSize]
  );

  const { data, loading, error } = useReportData({ fetcher: getSoldProductsReport, query });

  // The invoice table under the selector runs as its own query, so it only loads
  // once a product has actually been chosen.
  const linesQuery = useMemo(
    () => ({
      from: range.from || undefined,
      to: range.to || undefined,
      page: 1,
      pageSize: LINES_PAGE_SIZE,
      sort: "dateDesc",
    }),
    [range]
  );
  const selectedLines = useReportData({
    fetcher: ({ itemId, ...params }) => getSoldItemLines(itemId, "PRODUCT", params),
    query: productId ? { ...linesQuery, itemId: productId } : {},
    enabled: Boolean(productId),
  });
  const rows = data?.rows || [];
  const summary = { ...EMPTY_SUMMARY, ...(data?.summary || {}) };
  const selected = { ...EMPTY_SELECTED, ...(data?.selected || {}) };
  const pagination = data?.pagination || { total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };

  const rangeIsValid = !range.from || !range.to || range.from <= range.to;

  // Built here rather than inline below, so the memo's dependency is a stable
  // array rather than a fresh logical expression on every render.
  const soldOptions = useMemo(() => data?.options || [], [data]);

  const visibleOptions = useMemo(() => {
    const term = selectorSearch.trim().toLowerCase();
    if (!term) return soldOptions;
    return soldOptions.filter(
      (option) =>
        String(option.name || "").toLowerCase().includes(term) ||
        String(option.code || "").toLowerCase().includes(term)
    );
  }, [soldOptions, selectorSearch]);

  const closeSelector = useCallback(() => {
    setSelectorOpen(false);
    setSelectorSearch("");
  }, []);

  useEffect(() => {
    if (!selectorOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeSelector();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectorOpen, closeSelector]);

  const summaryCards = [
    {
      label: "Products sold",
      value: String(summary.soldItemCount || 0),
      hint: "Appear on at least one invoice line",
      icon: Package,
      tone: "primary",
    },
    {
      label: "Units sold",
      value: String(summary.unitsSold || 0),
      hint: "Across all these products",
      icon: BarChart3,
      tone: "info",
    },
    {
      label: "Revenue (excl. tax)",
      value: formatCurrency(summary.revenue),
      hint: `Tax collected ${formatCurrency(summary.taxCollected)}`,
      icon: Receipt,
      tone: "info",
    },
    {
      label: "Lines with no cost",
      value: String(summary.unknownLineCount || 0),
      hint: "Sold with no product purchase price",
      icon: AlertTriangle,
      tone: summary.unknownLineCount > 0 ? "warning" : "muted",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Product",
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-ink">{row.name}</div>
          {row.code && <div className="text-xs text-muted">{row.code}</div>}
        </div>
      ),
    },
    { key: "category", header: "Category", render: (row) => row.category || <span className="text-muted">—</span> },
    { key: "unitsSold", header: "Units sold", align: "right", render: (row) => row.unitsSold },
    { key: "revenue", header: "Revenue", align: "right", render: (row) => formatCurrency(row.revenue) },
    { key: "taxCollected", header: "Tax", align: "right", render: (row) => formatCurrency(row.taxCollected) },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      render: (row) =>
        row.cost === null ? <span className="text-muted">Cost price not added</span> : formatCurrency(row.cost),
    },
    {
      key: "profit",
      header: "Profit / loss",
      align: "right",
      render: (row) => <ProfitLabel value={row.profit} />,
    },
    {
      key: "marginPercent",
      header: "Margin %",
      align: "right",
      render: (row) =>
        row.marginPercent === null ? (
          <span className="text-muted">Not available</span>
        ) : (
          <span className={row.marginPercent >= 0 ? "text-success" : "text-danger"}>{row.marginPercent}%</span>
        ),
    },
  ];

  const lineColumns = [
    { key: "invoiceDate", header: "Date", render: (row) => formatDate(row.invoiceDate) },
    {
      key: "invoiceNumber",
      header: "Invoice",
      render: (row) => <span className="font-medium text-ink">{row.invoiceNumber}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) =>
        row.customer?.name ? <span className="text-ink">{row.customer.name}</span> : <span className="text-muted">—</span>,
    },
    { key: "quantity", header: "Quantity", align: "right", render: (row) => row.quantity },
    { key: "unitPrice", header: "Unit price", align: "right", render: (row) => formatCurrency(row.unitPrice) },
    { key: "tax", header: "Tax", align: "right", render: (row) => formatCurrency(row.tax) },
    {
      key: "profit",
      header: "Line profit",
      align: "right",
      render: (row) => <ProfitLabel value={row.profit} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Product-wise profit & loss"
        subtitle="Pick any product that has been sold to see its profit, or compare every sold product in the ranked table."
      />


      <div className="space-y-5">
        <ReportNote
          title="How this report is calculated"
          items={[
            "The cost at the time of sale is not stored on an invoice line, so the cost is the product's current purchase price excluding tax (per its tax mode).",
            "A product with no purchase price has no cost to subtract. Its profit is shown as Cost price not added, never as zero.",
            "Revenue excludes tax; tax collected is reported separately.",
          ]}
        />

        <ReportFilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search sold products by name or code—…"
          searchLabel="Search sold products"
          showDateRange
          range={range}
          onRangeChange={(next) => {
            setRange(next);
            setPage(1);
          }}
          rangeError={rangeIsValid ? "" : "The 'from' date must be on or before the 'to' date."}
          fields={[
            {
              key: "sort",
              label: "Sort",
              value: sort,
              onChange: (value) => {
                setSort(value);
                setPage(1);
              },
              options: ITEM_PROFIT_SORT_OPTIONS,
              width: "w-56",
            },
          ]}
          onReset={() => {
            setRange({ preset: "month", ...presetRange("month") });
            setProductId("");
            setSearch("");
            setSort("profitDesc");
            setPage(1);
          }}
        />

        {!rangeIsValid && (
          <ReportNote
            tone="error"
            title="Check the date range"
            items={["The 'from' date must be on or before the 'to' date."]}
          />
        )}

        {error && (
          <ReportNote
            tone="error"
            title="This report could not be loaded"
            items={[error]}
          />
        )}

        {loading ? (
          <SummaryCardsSkeleton count={4} />
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

        {/* Searchable product selector. Only sold products are offered. */}
        <Card>
          <CardHeader
            title="Sold product"
            description="Only products that appear on at least one invoice line are listed."
          />
          <div className="px-5 py-4">
            <div className="relative max-w-xl">
              <label className="sr-only" htmlFor="sold-product-picker">
                Choose a sold product
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <Input
                  id="sold-product-picker"
                  value={selectorOpen ? selectorSearch : selected.itemId ? selected.name : ""}
                  onFocus={() => {
                    setSelectorOpen(true);
                    setSelectorSearch("");
                  }}
                  onChange={(event) => {
                    setSelectorOpen(true);
                    setSelectorSearch(event.target.value);
                  }}
                  placeholder={selected.itemId ? selected.name : "Search a sold product—…"}
                  className="pl-9"
                />
              </div>

              {selectorOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close the product picker"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={closeSelector}
                  />
                  <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-pop scrollbar-slim">
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setProductId("");
                          closeSelector();
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-primary-50"
                      >
                        All sold products (no filter)
                      </button>
                    </li>
                    {visibleOptions.map((option) => (
                      <li key={option.itemId}>
                        <button
                          type="button"
                          onClick={() => {
                            setProductId(option.itemId);
                            closeSelector();
                          }}
                          className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-primary-50 ${
                            option.itemId === productId ? "bg-primary-50 text-primary-700" : "text-body"
                          }`}
                        >
                          {option.name}
                          {option.code && <span className="ml-2 text-xs text-muted">{option.code}</span>}
                        </button>
                      </li>
                    ))}
                    {visibleOptions.length === 0 && (
                      <li className="px-3 py-2 text-sm text-muted">No sold product matches that search.</li>
                    )}
                  </ul>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* The selected product's figures. */}
        {productId && (
          <Card>
            <CardHeader
              title={selected.name}
              description={`${selected.invoiceCount || 0} invoice(s) Â· ${
                selected.firstSaleDate ? formatDate(selected.firstSaleDate) : "—"
              } to ${selected.lastSaleDate ? formatDate(selected.lastSaleDate) : "—"}`}
            />
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Units sold" value={String(selected.unitsSold || 0)} icon={BarChart3} tone="info" />
              <StatCard
                label="Revenue (excl. tax)"
                value={formatCurrency(selected.revenue)}
                hint={`Tax collected ${formatCurrency(selected.taxCollected)}`}
                icon={Receipt}
                tone="primary"
              />
              <StatCard
                label="Cost of goods"
                value={
                  selected.cost === null ? (
                    <span className="text-muted">Cost price not added</span>
                  ) : (
                    formatCurrency(selected.cost)
                  )
                }
                hint="Current purchase price, excluding tax"
                icon={Wallet}
                tone="info"
              />
              <StatCard
                label="Profit / loss"
                value={<ProfitLabel value={selected.profit} />}
                hint={
                  selected.marginPercent === null
                    ? "Margin not available"
                    : `Margin ${selected.marginPercent}%`
                }
                icon={BarChart3}
                tone={selected.profit === null ? "muted" : selected.profit >= 0 ? "success" : "danger"}
              />
              <StatCard
                label="Average selling price"
                value={
                  selected.averageSellingPrice === null
                    ? NOT_AVAILABLE
                    : formatCurrency(selected.averageSellingPrice)
                }
                hint="Revenue divided by units sold"
                icon={Receipt}
                tone="muted"
              />
              <StatCard label="Invoices" value={String(selected.invoiceCount || 0)} icon={FileText} tone="primary" />
              <StatCard
                label="First sale"
                value={selected.firstSaleDate ? formatDate(selected.firstSaleDate) : "—"}
                icon={BarChart3}
                tone="muted"
              />
              <StatCard
                label="Last sale"
                value={selected.lastSaleDate ? formatDate(selected.lastSaleDate) : "—"}
                icon={BarChart3}
                tone="muted"
              />
            </div>

            {!selected.costKnown && (
              <div className="px-5 pb-5">
                <ReportNote
                  tone="warning"
                  title="Cost data not available for this product"
                  items={[
                    "No purchase price is recorded for this product, so its cost cannot be subtracted and the profit is reported as Cost price not added rather than as zero.",
                  ]}
                />
              </div>
            )}

            <CardHeader title="Invoices this product was sold on" />
            <ReportTable
              columns={lineColumns}
              rows={selectedLines.data?.rows || []}
              loading={selectedLines.loading}
              empty={
                <EmptyState
                  icon={FileText}
                  title="No invoices in this range"
                  description="Widen the date range to see the invoices this product was sold on."
                />
              }
            />
          </Card>
        )}

        {/* Ranked table of every sold product. */}
        <Card>
          <CardHeader
            title="All sold products"
            description="Every product with at least one sale in the selected range, ranked by the chosen sort."
          />
          <ReportTable
            columns={columns}
            rows={rows}
            loading={loading}
            rowKey={(row) => row.itemId}
            empty={
              <EmptyState
                icon={Package}
                title="No products have been sold in this range"
                description="Try a wider date range. Only products that appear on an invoice line are listed."
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


/** Green for a profit, red for a loss, grey for "we do not know". */
function ProfitLabel({ value }) {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-muted">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Cost price not added
      </span>
    );
  }

  const isProfit = Number(value) >= 0;

  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${isProfit ? "text-success" : "text-danger"}`}>
      {formatCurrency(value)}
    </span>
  );
}
