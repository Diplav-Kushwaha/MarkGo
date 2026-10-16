import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  HandCoins,
  Package,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { getDashboardSummary, getDashboardCharts } from "../../api/dashboardAdminApi";
import { formatCurrency } from "../../lib/format";
import { presetRange } from "../../lib/reportConstants";
import { cn } from "../../lib/cn";
import { Alert, PageHeader, Skeleton } from "../../components/ui";
import ReportFilterBar from "../../components/admin/reportFilterBar";
import useReportData from "../../components/admin/useReportData";
import {
  SalesPurchasesChart,
  ProfitTrendChart,
  TopProductsChart,
  IncomeExpenseChart,
  SectionErrorBoundary,
} from "../../components/admin/dashboardCharts";

/**
 * Company Admin dashboard.
 *
 * Summary cards and charts only. Every figure is read-only and comes from the
 * Reports read service, so the dashboard total equals its report. The range
 * selector drives the cards and the Income vs expense chart; the two monthly
 * charts have their own 6 / 12 month toggle. The old "Recent invoices" table
 * and the "Add customer" / "New invoice" quick actions were removed from this
 * page (their routes and files are untouched); no action list is added here.
 */

const fetchSummary = (query) => getDashboardSummary(query);
const fetchCharts = (query) => getDashboardCharts(query);

// Same tonal palette as StatCard so the cards read as one design system.
const TONES = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success-soft text-green-700",
  warning: "bg-warning-soft text-amber-700",
  danger: "bg-danger-soft text-red-700",
  info: "bg-info-soft text-info",
  muted: "bg-muted-soft text-slate-600",
};

function MoneyCard({ label, value, valueClass = "text-ink", sub, tone = "primary", icon: Icon, to }) {
  const navigate = useNavigate();
  const clickable = Boolean(to);
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => navigate(to) : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(to);
              }
            }
          : undefined
      }
      className={cn(
        "flex h-full flex-col rounded-card border border-primary-100/70 bg-white/95 p-5 shadow-card transition-all duration-200",
        clickable && "cursor-pointer hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-card-hover"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        {Icon && (
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-tile", TONES[tone])}>
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className={cn("mt-3 text-2xl font-bold tracking-tight", valueClass)}>{value}</p>
      {sub && <p className="mt-1 text-xs leading-5 text-muted">{sub}</p>}
      {clickable && (
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-primary-700">
          View report
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

function CountCard({ label, value, sub, icon: Icon, to }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="h-full min-h-28 rounded-tile border border-primary-100/70 bg-white/95 p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-card-hover"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {Icon && <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Icon className="h-4 w-4" aria-hidden="true" /></span>}
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
    </button>
  );
}

function changeLabel(changePercent) {
  if (changePercent === null || changePercent === undefined) return "No comparable previous period";
  const up = changePercent >= 0;
  return `${up ? "Up" : "Down"} ${Math.abs(changePercent)}% vs previous period`;
}

function RetryButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-1 rounded-control border border-line bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-primary-50"
    >
      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </button>
  );
}

function MoneyCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-card border border-primary-100/70 bg-white/95 p-5 shadow-card">
          <div className="flex items-start justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-10 rounded-tile" />
          </div>
          <Skeleton className="mt-4 h-7 w-28" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function CountCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-tile border border-primary-100/70 bg-white/95 p-4 shadow-card">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-6 w-10" />
          <Skeleton className="mt-1 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

function ProfitCard({ cards }) {
  const value = Number(cards.profit) || 0;
  const isProfit = value > 0;
  const isLoss = value < 0;
  const label = isProfit ? "Profit" : isLoss ? "Loss" : "Break-even";
  const shown = `${formatCurrency(value)} ${label}`;

  return (
    <MoneyCard
      label="Profit / loss"
      value={shown}
      valueClass={isProfit ? "text-success" : isLoss ? "text-danger" : "text-ink"}
      sub={
        <span>
          {cards.profitCoverageNote || "Based on sold products with a cost price"}
          {cards.profitHasExcluded && (
            <>
              {" "}
              <Link to="/admin/reports/products" className="font-medium text-primary-600 underline">
                Add cost prices to include more products
              </Link>
            </>
          )}
        </span>
      }
      tone={isProfit ? "success" : isLoss ? "danger" : "muted"}
      icon={isProfit ? TrendingUp : isLoss ? TrendingDown : BarChart3}
      to="/admin/reports/profit-loss"
    />
  );
}

export default function CompanyAdminDashboardHome() {
  const [range, setRange] = useState({ preset: "month", ...presetRange("month") });
  const [months, setMonths] = useState(6);
  const [metric, setMetric] = useState("revenue");

  const rangeIsValid = !range.from || !range.to || range.from <= range.to;

  const query = useMemo(
    () => ({
      range: range.preset,
      from: range.from || undefined,
      to: range.to || undefined,
    }),
    [range]
  );

  const chartsQuery = useMemo(() => ({ ...query, months }), [query, months]);

  const summary = useReportData({ fetcher: fetchSummary, query });
  const charts = useReportData({ fetcher: fetchCharts, query: chartsQuery });

  const data = summary.data;
  const cards = data?.cards || {};
  const counts = data?.counts || {};
  const chartsData = charts.data || {};

  const salesPurchasesPoints = (chartsData.salesPurchases || []).map((point) => ({
    key: point.month,
    label: point.label,
    year: point.year,
    sales: point.sales,
    purchases: point.purchases,
  }));

  const productsAvailable = counts.products?.available ?? 0;
  const productsTotal = counts.products?.total ?? 0;
  const servicesAvailable = counts.services?.available ?? 0;
  const servicesTotal = counts.services?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Sales, purchases, profit and dues for the selected period, with the charts that explain them."
      />

      <div className="space-y-4">
        <ReportFilterBar
          showDateRange
          range={range}
          onRangeChange={(next) => setRange(next)}
          rangeError={rangeIsValid ? "" : "The 'from' date must be on or before the 'to' date."}
          onReset={() => setRange({ preset: "month", ...presetRange("month") })}
        />

        {(summary.error || charts.error) && (
          <Alert tone="error" title="The dashboard could not be loaded">
            <div className="space-y-2">
              {summary.error && <p>{summary.error}</p>}
              {charts.error && <p>{charts.error}</p>}
              <div className="flex gap-2">
                {summary.error && <RetryButton onClick={summary.reload}>Retry cards</RetryButton>}
                {charts.error && <RetryButton onClick={charts.reload}>Retry charts</RetryButton>}
              </div>
            </div>
          </Alert>
        )}

        <SectionErrorBoundary label="set of cards">
        {summary.loading ? (
          <MoneyCardsSkeleton />
        ) : summary.error ? null : (
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <MoneyCard
              label="Total sales"
              value={formatCurrency(cards.totalSales || 0)}
              sub={changeLabel(cards.salesChangePercent)}
              tone="primary"
              icon={TrendingUp}
              to="/admin/reports/sales"
            />
            <MoneyCard
              label="Total purchases"
              value={formatCurrency(cards.totalPurchases || 0)}
              sub={changeLabel(cards.purchasesChangePercent)}
              tone="info"
              icon={ShoppingBag}
              to="/admin/reports/purchases"
            />
            <ProfitCard cards={cards} />
            <MoneyCard
              label="Amount to receive"
              value={formatCurrency(cards.amountToReceive || 0)}
              sub="Pending customer dues across the company"
              tone="warning"
              icon={HandCoins}
              to="/admin/reports/customers"
            />
            <MoneyCard
              label="Amount to pay"
              value={formatCurrency(cards.amountToPay || 0)}
              sub="Pending vendor dues across the company"
              tone="danger"
              icon={CreditCard}
              to="/admin/reports/vendors"
            />
            <MoneyCard
              label="Cash & bank balance"
              value="Not available"
              valueClass="text-muted"
              sub={cards.cashBank?.reason || "Available after Bank and Cash accounts are added"}
              tone="muted"
              icon={Wallet}
            />
          </div>
        )}
        </SectionErrorBoundary>

        <SectionErrorBoundary label="set of cards">
        {summary.loading ? (
          <CountCardsSkeleton />
        ) : summary.error ? null : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CountCard label="Customers" value={counts.customers || 0} sub="Total customers" icon={Users} to="/admin/reports/customers" />
            <CountCard label="Vendors" value={counts.vendors || 0} sub="Total vendors" icon={Store} to="/admin/reports/vendors" />
            <CountCard
              label="Products"
              value={productsTotal}
              sub={`${productsAvailable} available / ${productsTotal - productsAvailable} not available`}
              icon={Package}
              to="/admin/reports/products"
            />
            <CountCard
              label="Services"
              value={servicesTotal}
              sub={`${servicesAvailable} available / ${servicesTotal - servicesAvailable} not available`}
              icon={Wrench}
              to="/admin/reports/services"
            />
          </div>
        )}
        </SectionErrorBoundary>

        {!charts.error && (
          <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
            <SalesPurchasesChart
              className="xl:col-span-2"
              points={salesPurchasesPoints}
              loading={charts.loading}
              months={months}
              onMonthsChange={setMonths}
            />
            <ProfitTrendChart
              points={chartsData.profitTrend || []}
              loading={charts.loading}
              months={months}
              onMonthsChange={setMonths}
            />
            <TopProductsChart
              items={chartsData.topProducts?.items || []}
              unknownLineCount={chartsData.topProducts?.unknownLineCount || 0}
              loading={charts.loading}
              metric={metric}
              onMetricChange={setMetric}
            />
            <IncomeExpenseChart className="xl:col-span-2" data={chartsData.incomeExpense} loading={charts.loading} />
          </div>
        )}
      </div>
    </>
  );
}
