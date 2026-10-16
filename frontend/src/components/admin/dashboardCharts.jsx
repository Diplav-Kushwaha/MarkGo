import { Component } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardHeader } from "../ui";
import { cn } from "../../lib/cn";
import { formatCurrency, formatDate } from "../../lib/format";

/**
 * Dashboard charts, drawn with plain responsive CSS (no chart library is
 * installed, so none is added).
 *
 * Every chart is accessible: the graphic has a text summary via role="img" and
 * an aria-label, the legend names each series in words (never colour alone),
 * exact amounts appear in a `title` tooltip, and a collapsible table under each
 * chart is a full text alternative. Loading and empty ("No data for this
 * period") states are handled inside each chart. All text is plain ASCII.
 */

/** Money formatting that never renders "Rs.NaN": a non-number shows a dash. */
const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? formatCurrency(n) : "-";
};

/**
 * Compact fallback shown when one chart/card fails to render, so a single
 * error can never blank the whole dashboard. Local to the dashboard files; the
 * global ErrorBoundary is untouched.
 */
function SectionErrorCard({ label, onRetry }) {
  return (
    <Card className="flex h-full min-h-52 flex-col border-primary-100/70 bg-white/95 shadow-card">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium text-ink">This {label} could not be displayed</p>
        <p className="text-xs text-muted">Something went wrong rendering this section. The rest of the dashboard is unaffected.</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-10 items-center gap-1 rounded-control border border-line bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-primary-50"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      </div>
    </Card>
  );
}

export class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Dashboard section failed to render:", error);
  }

  render() {
    if (this.state.error) {
      return <SectionErrorCard label={this.props.label || "chart"} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

/** A readable label for tooltips and the table, adding the year where useful. */
function fullLabel(point) {
  const p = point || {};
  if (p.labelFull) return p.labelFull;
  const key = p.key || "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return formatDate(key);
  if (/^\d{4}-\d{2}$/.test(key)) return `${p.label} ${key.slice(0, 4)}`;
  if (p.year != null && p.label) return `${p.label} ${p.year}`;
  return p.label;
}

/** A small segmented control, e.g. the 6 / 12 months or Revenue / Quantity toggle. */
export function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div className="inline-flex rounded-full border border-primary-100 bg-primary-50/70 p-1 shadow-sm" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "min-h-9 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            value === option.value ? "bg-primary-700 text-white shadow-sm" : "text-body hover:bg-white hover:text-ink"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Legend({ series }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
      {series.map((entry) => (
        <span key={entry.key} className="flex items-center gap-1.5">
          <span className={cn("h-2.5 w-3 rounded-sm", entry.swatch)} aria-hidden="true" />
          {entry.label}
        </span>
      ))}
    </div>
  );
}

function BarsSkeleton() {
  return (
    <div className="flex h-52 items-end gap-1" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex h-full flex-1 items-end">
          <div className="h-full w-full animate-pulse rounded-t bg-primary-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-52 flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-ink">No data for this period</p>
      {message && <p className="mt-1 text-xs text-muted">{message}</p>}
    </div>
  );
}

/** Card frame shared by all four charts: header, loading, empty, body, legend, table. */
function ChartShell({ title, description, actions, footnote, loading, empty, ariaLabel, legend, children, table, className }) {
  return (
    <Card className={cn("flex h-full flex-col border-primary-100/70 bg-white/95 shadow-card", className)}>
      <CardHeader title={title} description={description} actions={actions} className="flex-wrap" />
      <div className="flex flex-1 flex-col p-5">
        {loading ? (
          <BarsSkeleton />
        ) : empty ? (
          <EmptyChart message={typeof empty === "string" ? empty : undefined} />
        ) : (
          <div className="rounded-tile bg-primary-50/45 p-3 sm:p-4" role="img" aria-label={ariaLabel}>
            {children}
            {legend}
          </div>
        )}
        {!loading && !empty && footnote && <p className="mt-3 text-xs text-muted">{footnote}</p>}
        {!loading && !empty && table}
      </div>
    </Card>
  );
}

function DataFallback({ caption, columns, rows }) {
  const columnList = Array.isArray(columns) ? columns : [];
  const rowList = Array.isArray(rows) ? rows : [];

  const headerText = (column) => (column.label ?? column.header ?? column.key ?? "");
  const cellValue = (column, row) => {
    if (typeof column.render === "function") return column.render(row);
    if (typeof column.format === "function") return column.format(row[column.key], row);
    const value = column.key != null ? row[column.key] : undefined;
    return value === null || value === undefined ? "-" : value;
  };

  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-muted hover:text-ink">View as table</summary>
      <div className="mt-2 overflow-x-auto scrollbar-slim">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-muted">
              {columnList.map((column, index) => (
                <th
                  key={column.key ?? index}
                  className={cn("border-b border-line py-1 pr-3 font-medium", column.align === "right" && "text-right")}
                >
                  {headerText(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowList.map((row, rowIndex) => (
              <tr key={row.key ?? rowIndex}>
                {columnList.map((column, cellIndex) => (
                  <td
                    key={column.key ?? cellIndex}
                    className={cn("border-b border-line py-1 pr-3 text-body", column.align === "right" && "text-right")}
                  >
                    {cellValue(column, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const hasData = (points, keys) => {
  const list = Array.isArray(points) ? points : [];
  return list.some((point) => keys.some((key) => Number(point?.[key]) > 0));
};

/** Two series side by side per bucket. */
function GroupedBars({ points, series, formatValue }) {
  const list = Array.isArray(points) ? points : [];
  const keys = series.map((entry) => entry.key);
  const max = Math.max(1, ...list.flatMap((point) => keys.map((key) => Math.abs(Number(point?.[key]) || 0))));

  return (
    <div>
      <div className="flex h-52 items-end gap-1">
        {list.map((point) => (
          <div key={point.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex h-full w-full items-end justify-center gap-[3px]">
              {series.map((entry) => {
                const value = Number(point[entry.key]) || 0;
                const height = (Math.abs(value) / max) * 100;
                return (
                  <div
                    key={entry.key}
                    className={cn("w-full max-w-[16px] rounded-t", entry.swatch)}
                    style={{ height: `${height}%` }}
                    title={`${fullLabel(point)}: ${entry.label} ${formatValue(value)}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {list.map((point) => (
          <div key={point.key} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted" title={fullLabel(point)}>
            {point.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function groupedTable(points, series, formatValue, caption) {
  return (
    <DataFallback
      caption={caption}
      columns={[{ key: "label", label: "Period" }, ...series.map((entry) => ({ key: entry.key, label: entry.label, align: "right" }))]}
      rows={points.map((point) => ({
        key: point.key,
        label: fullLabel(point),
        ...Object.fromEntries(series.map((entry) => [entry.key, formatValue(point[entry.key])])),
      }))}
    />
  );
}

/** Profit per month: bars above the zero line for profit, below for loss. */
function ProfitBars({ points }) {
  const list = Array.isArray(points) ? points : [];
  const max = Math.max(1, ...list.map((point) => Math.abs(Number(point?.profit) || 0)));
  const eligibleTotal = list.reduce((sum, point) => sum + (Number(point?.eligibleItems) || 0), 0);
  const soldTotal = list.reduce((sum, point) => sum + (Number(point?.totalSoldItems) || 0), 0);

  return (
    <div>
      <div className="flex h-52 items-stretch gap-1">
        {list.map((point) => {
          const value = Number(point?.profit) || 0;
          const height = (Math.abs(value) / max) * 50;
          const eligible = Number(point?.eligibleItems) || 0;
          const total = Number(point?.totalSoldItems) || 0;
          const coverage = total > 0 ? `${eligible} of ${total}` : "0 of 0";
          const tip =
            eligible === 0
              ? `${point.label} ${point.year}: no sold products with a cost price (0 of ${total})`
              : `${point.label} ${point.year}: ${value >= 0 ? "profit" : "loss"} ${money(value)} - based on ${coverage} sold products with a cost price`;
          return (
            <div key={point.month} className="relative flex min-w-0 flex-1 flex-col">
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" aria-hidden="true" />
              {value >= 0 ? (
                <div className="absolute bottom-1/2 left-1/2 w-full max-w-[16px] -translate-x-1/2 rounded-t bg-success" style={{ height: `${height}%` }} title={tip} />
              ) : (
                <div className="absolute left-1/2 top-1/2 w-full max-w-[16px] -translate-x-1/2 rounded-b bg-danger" style={{ height: `${height}%` }} title={tip} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {list.map((point) => (
          <div key={point.month} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted">
            {point.label}
          </div>
        ))}
      </div>
      {soldTotal > 0 && eligibleTotal < soldTotal && (
        <p className="mt-2 text-xs text-muted">
          Based on {eligibleTotal} of {soldTotal} sold products with a cost price across these months.
        </p>
      )}
    </div>
  );
}

/** Horizontal ranked bars for the top selling products. */
function RankedBars({ items, valueKey, formatValue, valueLabel }) {
  const list = Array.isArray(items) ? items : [];
  const max = Math.max(1, ...list.map((item) => Number(item?.[valueKey]) || 0));
  return (
    <ol className="space-y-3">
      {list.map((item) => {
        const value = Number(item[valueKey]) || 0;
        return (
          <li key={item.itemId}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-ink" title={item.name}>
                {item.name}
              </span>
              <span className="shrink-0 font-medium text-ink">{formatValue(value)}</span>
            </div>
            <div className="mt-1 h-2.5 w-full rounded-full bg-primary-50">
              <div className="h-2.5 rounded-full bg-chart-purple" style={{ width: `${(value / max) * 100}%` }} title={`${item.name}: ${valueLabel} ${formatValue(value)}`} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// --- The four dashboard charts ---------------------------------------------

const SALES_PURCHASE_SERIES = [
  { key: "sales", label: "Sales", swatch: "bg-chart-purple" },
  { key: "purchases", label: "Purchases", swatch: "bg-chart-indigo" },
];

const MONTH_TOGGLE = [
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
];

export function SalesPurchasesChart({ points = [], loading, months, onMonthsChange, className }) {
  const empty = hasData(points, ["sales", "purchases"]) ? false : "No invoices or bills recorded in these months yet.";
  return (
    <SectionErrorBoundary label="chart">
    <ChartShell
      title="Sales vs purchases"
      description="Invoiced and billed totals for each recent month."
      actions={<SegmentedControl label="Number of months" options={MONTH_TOGGLE} value={months} onChange={onMonthsChange} />}
      loading={loading}
      empty={empty}
      ariaLabel="Grouped bar chart comparing monthly sales and purchases"
      legend={<Legend series={SALES_PURCHASE_SERIES} />}
      className={className}
      table={groupedTable(points, SALES_PURCHASE_SERIES, money, "Monthly sales and purchases")}
    >
      <GroupedBars points={points} series={SALES_PURCHASE_SERIES} formatValue={money} />
    </ChartShell>
    </SectionErrorBoundary>
  );
}

export function ProfitTrendChart({ points = [], loading, months, onMonthsChange, className }) {
  const list = Array.isArray(points) ? points : [];
  const soldTotal = list.reduce((sum, point) => sum + (Number(point?.totalSoldItems) || 0), 0);
  const empty = list.length ? false : "No data for this period";
  return (
    <SectionErrorBoundary label="chart">
    <ChartShell
      title="Profit trend"
      description="Monthly profit or loss, using the same rule as the Profit and Loss report."
      actions={<SegmentedControl label="Number of months" options={MONTH_TOGGLE} value={months} onChange={onMonthsChange} />}
      loading={loading}
      empty={empty}
      footnote={
        soldTotal === 0 && !loading
          ? "No sold products with a cost price in these months."
          : "Profit is counted only for sold products that have a cost price."
      }
      ariaLabel="Bar chart of monthly profit above the line and loss below the line"
      className={className}
      legend={
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-3 rounded-sm bg-success" aria-hidden="true" />
            Profit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-3 rounded-sm bg-danger" aria-hidden="true" />
            Loss
          </span>
        </div>
      }
      table={
        <DataFallback
          caption="Monthly profit, revenue and cost"
          columns={[
            { key: "label", label: "Month" },
            { key: "revenue", label: "Revenue", align: "right" },
            { key: "cost", label: "Cost", align: "right" },
            { key: "profit", label: "Profit / loss", align: "right" },
          ]}
          rows={list.map((point) => ({
            key: point.month,
            label: `${point.label} ${point.year}`,
            revenue: money(point.revenue),
            cost: money(point.cost),
            profit: money(point.profit),
          }))}
        />
      }
    >
      <ProfitBars points={points} />
    </ChartShell>
    </SectionErrorBoundary>
  );
}

const TOP_PRODUCT_TOGGLE = [
  { value: "revenue", label: "By revenue" },
  { value: "quantity", label: "By quantity" },
];

export function TopProductsChart({ items = [], unknownLineCount = 0, loading, metric, onMetricChange, className }) {
  const isQuantity = metric === "quantity";
  const formatValue = isQuantity ? (value) => `${Number(value) || 0}` : money;
  const footnote =
    unknownLineCount > 0
      ? `${unknownLineCount} sold line(s) had no product linked and are not shown.`
      : "Only products that were actually sold are listed.";

  return (
    <SectionErrorBoundary label="chart">
    <ChartShell
      title="Top 5 selling products"
      description="Best sellers in the selected period."
      actions={<SegmentedControl label="Rank top products by" options={TOP_PRODUCT_TOGGLE} value={metric} onChange={onMetricChange} />}
      loading={loading}
      empty={items.length ? false : "No products were sold in this period."}
      ariaLabel="Ranked list of the five best selling products"
      className={className}
      footnote={footnote}
      table={
        <DataFallback
          caption="Top products by revenue and quantity"
          columns={[
            { key: "name", label: "Product" },
            { key: "revenue", label: "Revenue", align: "right" },
            { key: "unitsSold", label: "Quantity", align: "right" },
          ]}
          rows={items.map((item) => ({
            key: item.itemId,
            name: item.name,
            revenue: money(item.revenue),
            unitsSold: `${item.unitsSold}`,
          }))}
        />
      }
    >
      <RankedBars items={items} valueKey={isQuantity ? "unitsSold" : "revenue"} formatValue={formatValue} valueLabel={isQuantity ? "quantity" : "revenue"} />
    </ChartShell>
    </SectionErrorBoundary>
  );
}

const INCOME_EXPENSE_SERIES = [
  { key: "income", label: "Income", swatch: "bg-chart-purple" },
  { key: "expense", label: "Expense", swatch: "bg-chart-pink" },
];

export function IncomeExpenseChart({ data, loading, className }) {
  const points = data?.points || [];
  const empty = hasData(points, ["income", "expense"]) ? false : "No money moved in this period.";
  const basisNote =
    data?.basis === "payments"
      ? "Based on recorded payments: money received from customers and money paid to vendors."
      : "Based on sales and purchases: no payments are recorded in this period, so income uses invoice totals and expense uses bill totals.";

  return (
    <SectionErrorBoundary label="chart">
    <ChartShell
      title="Income vs expense"
      description={`${basisNote} Total income ${money(data?.totalIncome || 0)} and total expense ${money(
        data?.totalExpense || 0
      )}.`}
      loading={loading}
      empty={empty}
      ariaLabel="Grouped bar chart comparing income and expense for the selected period"
      className={className}
      legend={<Legend series={INCOME_EXPENSE_SERIES} />}
      table={groupedTable(points, INCOME_EXPENSE_SERIES, money, "Income and expense by period")}
    >
      <GroupedBars points={points} series={INCOME_EXPENSE_SERIES} formatValue={money} />
    </ChartShell>
    </SectionErrorBoundary>
  );
}
