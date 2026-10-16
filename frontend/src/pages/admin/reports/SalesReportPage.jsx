import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  Percent,
  Receipt,
} from "lucide-react";
import { getSalesListReport } from "../../../api/reportAdminApi";
import { getCustomers } from "../../../api/customerAdminApi";
import { formatCurrency, formatDate } from "../../../lib/format";
import {
  PAYMENT_STATUS_FILTERS,
  SALES_SORT_OPTIONS,
  presetRange,
} from "../../../lib/reportConstants";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
} from "../../../components/ui";
import ReportFilterBar, { ReportNote, ReportTable, SummaryCardsSkeleton } from "../../../components/admin/reportFilterBar";
import useReportData from "../../../components/admin/useReportData";
import InvoiceStatusBadge from "../../../components/invoices/InvoiceStatusBadge";

/**
 * 1. SALES REPORT
 *
 * Lists the invoices (sales) of the selected date range. The sales side of the
 * ledger is stored in full on `invoices` — subtotal, discount, tax, total, paid
 * and due are all columns — so every figure on this page comes straight from
 * there and nothing is estimated.
 *
 * Draft and cancelled invoices are not sales: a draft was never sent and a
 * cancelled one is voided, so both are excluded, exactly as the sales report
 * that already lived on /admin/reports excludes them.
 */

const PAGE_SIZE = 10;

const EMPTY_SUMMARY = {
  invoiceCount: 0,
  totalSales: 0,
  totalTax: 0,
  totalDiscount: 0,
  totalReceived: 0,
  totalPending: 0,
  subtotal: 0,
};

export default function SalesReportPage() {
  const [range, setRange] = useState({ preset: "month", ...presetRange("month") });
  const [customerId, setCustomerId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("dateDesc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [rangeError, setRangeError] = useState("");

  const query = useMemo(
    () => ({
      from: range.from || undefined,
      to: range.to || undefined,
      customerId: customerId || undefined,
      paymentStatus: paymentStatus || undefined,
      search: search.trim() || undefined,
      sort,
      page,
      pageSize,
    }),
    [range, customerId, paymentStatus, search, sort, page, pageSize]
  );


  const { data, loading, error } = useReportData({ fetcher: getSalesListReport, query });
  // The customer filter is a plain list of the company's customers.
  const customers = useReportData({ fetcher: () => getCustomers({ pageSize: 100 }), query: {} });
  const rows = data?.rows || [];
  const summary = { ...EMPTY_SUMMARY, ...(data?.summary || {}) };
  const pagination = data?.pagination || { total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };

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
      label: "Total sales",
      value: formatCurrency(summary.totalSales),
      hint: `${summary.invoiceCount || 0} invoice(s) in this range`,
      icon: FileText,
      tone: "primary",
    },
    {
      label: "Tax",
      value: formatCurrency(summary.totalTax),
      hint: `Collected on top of ${formatCurrency(summary.subtotal)}`,
      icon: Percent,
      tone: "info",
    },
    {
      label: "Discount",
      value: formatCurrency(summary.totalDiscount),
      hint: "Given on these invoices",
      icon: Receipt,
      tone: "info",
    },
    {
      label: "Received",
      value: formatCurrency(summary.totalReceived),
      hint: "Paid against these invoices",
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Pending",
      value: formatCurrency(summary.totalPending),
      hint: "Still due on these invoices",
      icon: Clock,
      tone: "danger",
    },
  ];

  const columns = [
    {
      key: "invoiceNumber",
      header: "Invoice",
      sortable: true,
      sortAsc: "invoiceAsc",
      sortDesc: "dateDesc",
      value: (row) => String(row.invoiceNumber || ""),
      render: (row) => <span className="font-medium text-ink">{row.invoiceNumber}</span>,
    },
    { key: "invoiceDate", header: "Date", render: (row) => formatDate(row.invoiceDate) },
    {
      key: "customer",
      header: "Customer",
      render: (row) =>
        row.customer?.name ? (
          <span className="text-ink">{row.customer.name}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "subtotal",
      header: "Subtotal",
      align: "right",
      render: (row) => formatCurrency(row.subtotal),
    },
    {
      key: "discountTotal",
      header: "Discount",
      align: "right",
      render: (row) => formatCurrency(row.discountTotal),
    },
    { key: "taxTotal", header: "Tax", align: "right", render: (row) => formatCurrency(row.taxTotal) },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => <span className="font-medium text-ink">{formatCurrency(row.total)}</span>,
    },
    {
      key: "paid",
      header: "Paid",
      align: "right",
      render: (row) => <span className="text-success">{formatCurrency(row.paid)}</span>,
    },
    {
      key: "due",
      header: "Due",
      align: "right",
      render: (row) => (
        <span className={Number(row.due) > 0 ? "font-medium text-danger" : "text-muted"}>
          {formatCurrency(row.due)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <InvoiceStatusBadge status={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Sales"
        subtitle="Every invoice issued in the selected period, with discounts, tax, what has been received and what is still due."
      />


      <div className="space-y-5">
        <ReportFilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search by invoice number—…"
          searchLabel="Search invoices by number"
          showDateRange
          range={range}
          onRangeChange={(next) => {
            setRange(next);
            setPage(1);
          }}
          rangeError={rangeError}
          fields={[
            {
              key: "customerId",
              label: "Customer",
              value: customerId,
              onChange: (value) => {
                setCustomerId(value);
                setPage(1);
              },
              options: customerOptions,
              width: "w-48",
            },
            {
              key: "paymentStatus",
              label: "Payment status",
              value: paymentStatus,
              onChange: (value) => {
                setPaymentStatus(value);
                setPage(1);
              },
              options: PAYMENT_STATUS_FILTERS,
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
              options: SALES_SORT_OPTIONS,
              width: "w-52",
            },
          ]}
          onReset={() => {
            setRange({ preset: "month", ...presetRange("month") });
            setCustomerId("");
            setPaymentStatus("");
            setSearch("");
            setSort("dateDesc");
            setPage(1);
            setRangeError("");
          }}
        />

        {!rangeIsValid && (
          <ReportNote
            tone="error"
            title="Check the date range"
            items={["The 'from' date must be on or before the 'to' date. Widen or swap the two dates."]}
          />
        )}

        {error && (
          <ReportNote
            tone="error"
            title="This report could not be loaded"
            items={[error, "The filters were not changed — reloading keeps the same period."]}
          />
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
            title="Invoices in this range"
            description="Sorted by the option chosen in the filter bar. The cards also carry the tax and discount totals of the filtered set."
          />
          <ReportTable
            columns={columns}
            rows={rows}
            loading={loading}
            sortValue={sort}
            onSortChange={(value) => {
              setSort(value);
              setPage(1);
            }}
            empty={
              <EmptyState
                icon={FileText}
                title="No invoices in this range"
                description="Try a wider date range, a different customer or a different payment status."
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
