import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Percent,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { getCustomers } from "../../../api/customerAdminApi";
import { getProfitLossReport } from "../../../api/reportAdminApi";
import { formatCurrency, formatDate } from "../../../lib/format";
import { PROFIT_LOSS_VIEW_OPTIONS, presetRange } from "../../../lib/reportConstants";
import {
  Alert,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
} from "../../../components/ui";
import ReportFilterBar, { ReportNote, ReportTable, SummaryCardsSkeleton, } from "../../../components/admin/reportFilterBar";
import useReportData from "../../../components/admin/useReportData";

/**
 * 4. PROFIT & LOSS
 *
 * Revenue and cost for the selected range, overall or split by day, month or
 * year.
 *
 * Calculation rules (also printed on the page):
 *   - Revenue is the invoice subtotal less the invoice discount, so it never
 *     includes tax. A discount reduces revenue.
 *   - Cost of goods sold comes from the CURRENT purchase price of each sold
 *     product, excluding tax according to its tax mode, because a sold line item
 *     stores no cost at the time of sale.
 *   - A line whose item was never linked to a catalogue row, or whose product has
 *     no purchase price, has no cost. Those lines are counted, excluded from
 *     profit, and shown as "cost unknown" — never treated as zero-cost.
 *   - Tax collected and tax paid are shown separately and are never counted as
 *     profit.
 *   - There is no expense record in the schema, so net profit equals gross
 *     profit and the page says so rather than showing an expense total.
 */


const EMPTY_SUMMARY = {
  invoiceCount: 0,
  revenue: 0,
  cost: 0,
  eligibleRevenue: 0,
  eligibleCost: 0,
  tax: 0,
  profit: 0,
  grossProfit: 0,
  netProfit: 0,
  marginPercent: 0,
  expenses: 0,
  expensesAvailable: false,
  eligibleItemCount: 0,
  totalSoldItemCount: 0,
  excludedItemCount: 0,
  excludedRevenue: 0,
  excludedLineCount: 0,
};


/**
 * Profit / loss label. A missing cost is not a loss, so it is told apart from a
 * real negative figure instead of being coloured red.
 */
function ProfitLabel({ value }) {
  // With no eligible lines the profit is 0.00, never "not available".
  const amount = Number(value) || 0;
  const isProfit = amount >= 0;

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold ${
        isProfit ? "text-success" : "text-danger"
      }`}
    >
      {isProfit ? (
        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {formatCurrency(amount)}
    </span>
  );
}

export default function ProfitLossReportPage() {
  const [range, setRange] = useState({ preset: "year", ...presetRange("year") });
  const [view, setView] = useState("overall");
  const [customerId, setCustomerId] = useState("");

  const query = useMemo(
    () => ({
      from: range.from || undefined,
      to: range.to || undefined,
      groupBy: view,
      customerId: customerId || undefined,
    }),
    [range, view, customerId]
  );

  const { data, loading, error } = useReportData({ fetcher: getProfitLossReport, query });
  const customers = useReportData({ fetcher: () => getCustomers({ pageSize: 100 }), query: {} });

  const summary = { ...EMPTY_SUMMARY, ...(data?.summary || {}) };
  const periods = data?.periods || [];

  const rangeIsValid = !range.from || !range.to || range.from <= range.to;

  const customerOptions = useMemo(() => {
    const list = customers.data?.customers || [];
    return [
      { value: "", label: "All customers" },
      ...list.map((customer) => ({ value: customer.id, label: customer.name })),
    ];
  }, [customers.data]);

  const summaryCards = [
    {
      label: "Revenue (excl. tax)",
      value: formatCurrency(summary.revenue),
      hint: (summary.invoiceCount || 0) + " invoice(s) in this range",
      icon: Receipt,
      tone: "primary",
    },
    {
      label: "Eligible revenue",
      value: formatCurrency(summary.eligibleRevenue),
      hint: "Sold products that have a cost price",
      icon: Receipt,
      tone: "info",
    },
    {
      label: "Eligible cost",
      value: formatCurrency(summary.eligibleCost),
      hint: "Cost of goods sold from those products",
      icon: Wallet,
      tone: "info",
    },
    {
      label: "Tax collected",
      value: formatCurrency(summary.tax),
      hint: "Shown separately, never counted as profit",
      icon: Percent,
      tone: "info",
    },
    {
      label: "Net profit / loss",
      value: <ProfitLabel value={summary.netProfit} />,
      hint: "Margin " + (summary.marginPercent || 0) + "%",
      icon: BarChart3,
      tone: summary.netProfit >= 0 ? "success" : "danger",
    },
    {
      label: "Products without cost",
      value: String(summary.excludedItemCount || 0),
      hint: formatCurrency(summary.excludedRevenue) + " of revenue not counted",
      icon: AlertTriangle,
      tone: summary.excludedItemCount > 0 ? "warning" : "muted",
    },
  ];

  const columns = [
    {
      key: "label",
      header: view === "overall" ? "Overall" : "Period",
      render: (row) => <span className="font-medium text-ink">{row.label}</span>,
    },
    { key: "invoiceCount", header: "Invoices", align: "right", render: (row) => row.invoiceCount },
    { key: "revenue", header: "Revenue", align: "right", render: (row) => formatCurrency(row.revenue) },
    { key: "cost", header: "Cost of goods", align: "right", render: (row) => formatCurrency(row.cost) },
    { key: "tax", header: "Tax", align: "right", render: (row) => formatCurrency(row.tax) },
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
          <span className={row.marginPercent >= 0 ? "text-success" : "text-danger"}>
            {row.marginPercent}%
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Profit & loss"
        subtitle="Revenue against cost for the selected period, overall or split by day, month or year."
      />


      <div className="space-y-5">
                <ReportNote
          title="How this report is calculated"
          items={[
            "Profit is counted only for sold products that have a cost price, using the units sold: profit is the eligible revenue minus the cost per unit times the units sold.",
            "Eligible revenue is a line's subtotal minus its discount (never tax); the cost per unit is the product's current purchase price excluding tax, per its tax mode (INCLUSIVE is divided out).",
            "Items with no cost price, and services, are never counted as profit and never blank the result - they are shown as excluded instead.",
            "Total sales revenue includes every sold item and is not the same as the eligible revenue the profit is built from.",
            "Tax collected on sales and tax paid on purchases are reported separately and are never counted as profit. There is no expense record in the schema, so net profit equals gross profit.",
          ]}
        />

        <ReportFilterBar
          showDateRange
          range={range}
          onRangeChange={(next) => setRange(next)}
          rangeError={rangeIsValid ? "" : "The 'from' date must be on or before the 'to' date."}
          fields={[
            {
              key: "view",
              label: "View",
              value: view,
              onChange: setView,
              options: PROFIT_LOSS_VIEW_OPTIONS,
              width: "w-40",
            },
            {
              key: "customerId",
              label: "Customer",
              value: customerId,
              onChange: setCustomerId,
              options: customerOptions,
              width: "w-48",
            },
          ]}
          onReset={() => {
            setRange({ preset: "year", ...presetRange("year") });
            setView("overall");
            setCustomerId("");
          }}
        />

        {!rangeIsValid && (
          <Alert tone="error" title="Check the date range">
            The 'from' date must be on or before the 'to' date. Widen or swap the two dates.
          </Alert>
        )}

        {error && (
          <Alert tone="error" title="This report could not be loaded">
            {error}
          </Alert>
        )}

                {!loading && summary.totalSoldItemCount > 0 && (
          <Alert tone={summary.excludedItemCount > 0 ? "warning" : "info"} title="Profit coverage">
            <div className="space-y-1">
              <p>Based on {summary.eligibleItemCount} of {summary.totalSoldItemCount} sold products with a cost price.</p>
              {summary.excludedItemCount > 0 && (
                <p>
                  {summary.excludedItemCount} product(s), {formatCurrency(summary.excludedRevenue)} of revenue, have no cost price yet.{" "}
                  <Link to="/admin/reports/products" className="font-medium text-primary-600 underline">
                    Add cost prices to include more products
                  </Link>
                  .
                </p>
              )}
            </div>
          </Alert>
        )}
        {loading ? (
          <SummaryCardsSkeleton count={6} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

        {/* Simple CSS bars. The project has no chart library installed, so the
            period comparison is drawn with plain, accessible bars. */}
        {!loading && periods.length > 1 && (
          <Card>
            <CardHeader
              title="Profit by period"
              description="Each bar is that period's net profit; a negative period is drawn below the line."
            />
            <div className="px-5 py-4">
              <PeriodBars periods={periods} />
            </div>
          </Card>
        )}

        <Card>
          <CardHeader
            title={view === "overall" ? "Overall" : `By ${view === "day" ? "date" : view}`}
            description="Revenue, cost, tax and profit for each period in the selected range."
          />
          <ReportTable
            columns={columns}
            rows={periods}
            loading={loading}
            empty={
              <EmptyState
                icon={BarChart3}
                title="No sales in this range"
                description="Try a wider date range or clear the customer filter."
              />
            }
          />
        </Card>
      </div>
    </>
  );
}

/** Bars for the period comparison, scaled to the largest absolute profit. */
function PeriodBars({ periods }) {
  const values = periods.map((period) => (period.profit === null ? 0 : period.profit));
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  const hasNegative = values.some((value) => value < 0);
  const hasPositive = values.some((value) => value > 0);

  return (
    <div>
      <div className="flex h-40 items-end gap-1" role="img" aria-label="Profit by period">
        {periods.map((period) => {
          const value = period.profit === null ? 0 : period.profit;
          const height = `${(Math.abs(value) / max) * 100}%`;
          const colour =
            period.profit === null
              ? "bg-slate-200"
              : value >= 0
                ? "bg-success"
                : "bg-danger";

          return (
            <div key={period.period} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
              <div className="relative flex h-full w-full items-end">
                {hasNegative && (
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-line" />
                )}
                <div
                  className={`w-full rounded-t ${colour} ${value < 0 ? "rounded-b-none" : ""}`}
                  style={{ height }}
                  title={`${period.label}: ${formatCurrency(value)}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1 overflow-x-auto scrollbar-slim">
        {periods.map((period) => (
          <div
            key={period.period}
            className="min-w-0 flex-1 truncate text-center text-[10px] text-muted"
            title={`${period.label} — ${formatCurrency(period.revenue)} revenue`}
          >
            {formatPeriodTick(period.label)}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-success" aria-hidden="true" />
          Profit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-danger" aria-hidden="true" />
          Loss
        </span>
                {!hasPositive && <span>No profitable period in this range.</span>}
        {!hasNegative && hasPositive && periods.length > 1 && <span>No loss-making period in this range.</span>}
      </div>
    </div>
  );
}

/** Shortens a bucket label so a daily view still fits on one line. */
function formatPeriodTick(label) {
  if (label === "overall") return "Overall";
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return formatDate(label);
  return label;
}
