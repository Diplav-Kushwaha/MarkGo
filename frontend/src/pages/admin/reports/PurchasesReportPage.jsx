import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  Landmark,
  Percent,
  Receipt,
} from "lucide-react";
import { getPurchasesReport, } from "../../../api/reportAdminApi";
import { getVendors } from "../../../api/vendorAdminApi";
import { formatCurrency, formatDate } from "../../../lib/format";
import { PAYMENT_STATUS_FILTERS, PURCHASE_SORT_OPTIONS, presetRange } from "../../../lib/reportConstants";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
} from "../../../components/ui";
import ReportFilterBar, { ReportNote, ReportTable, SummaryCardsSkeleton, } from "../../../components/admin/reportFilterBar";
import useReportData from "../../../components/admin/useReportData";
import BillStatusBadge from "../../../components/bills/BillStatusBadge";

/**
 * 2. PURCHASES REPORT
 *
 * Same pattern as the Sales report, for what the company buys. Bills store a
 * single `total` plus what has been paid and what is due; the schema has no
 * subtotal, discount or tax column on either `bills` or `bill_items`, so those
 * two figures are shown as "Not recorded" instead of being invented, and the
 * page says so in a note.
 */

const PAGE_SIZE = 10;

const EMPTY_SUMMARY = {
  billCount: 0,
  totalPurchases: 0,
  totalPaid: 0,
  totalPending: 0,
  totalTax: null,
  totalDiscount: null,
};

const NOT_RECORDED = <span className="text-muted">Not recorded</span>;

export default function PurchasesReportPage() {
  const [range, setRange] = useState({ preset: "month", ...presetRange("month") });
  const [vendorId, setVendorId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("dateDesc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const query = useMemo(
    () => ({
      from: range.from || undefined,
      to: range.to || undefined,
      vendorId: vendorId || undefined,
      paymentStatus: paymentStatus || undefined,
      search: search.trim() || undefined,
      sort,
      page,
      pageSize,
    }),
    [range, vendorId, paymentStatus, search, sort, page, pageSize]
  );

  const { data, loading, error } = useReportData({ fetcher: getPurchasesReport, query });
  const vendors = useReportData({ fetcher: () => getVendors({ pageSize: 100 }), query: {} });

  const rows = data?.rows || [];
  const summary = { ...EMPTY_SUMMARY, ...(data?.summary || {}) };
  const pagination = data?.pagination || { total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };

  const rangeIsValid = !range.from || !range.to || range.from <= range.to;

  const vendorOptions = useMemo(() => {
    const list = vendors.data?.vendors || [];
    return [
      { value: "", label: "All vendors" },
      ...list.map((vendor) => ({ value: vendor.id, label: vendor.name })),
    ];
  }, [vendors.data]);

  const summaryCards = [
    {
      label: "Total purchases",
      value: formatCurrency(summary.totalPurchases),
      hint: `${summary.billCount || 0} bill(s) in this range`,
      icon: Receipt,
      tone: "primary",
    },
    {
      label: "Paid",
      value: formatCurrency(summary.totalPaid),
      hint: "Settled against these bills",
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Pending",
      value: formatCurrency(summary.totalPending),
      hint: "Still owed on these bills",
      icon: Clock,
      tone: "danger",
    },
    {
      label: "Tax",
      value: NOT_RECORDED,
      hint: "No tax is stored on a bill",
      icon: Percent,
      tone: "muted",
    },
    {
      label: "Discount",
      value: NOT_RECORDED,
      hint: "No discount is stored on a bill",
      icon: Landmark,
      tone: "muted",
    },
  ];

  const columns = [
    {
      key: "billNumber",
      header: "Bill",
      sortable: true,
      sortAsc: "billAsc",
      sortDesc: "dateDesc",
      value: (row) => String(row.billNumber || ""),
      render: (row) => <span className="font-medium text-ink">{row.billNumber}</span>,
    },
    { key: "billDate", header: "Date", render: (row) => formatDate(row.billDate) },
    {
      key: "vendor",
      header: "Vendor",
      render: (row) =>
        row.vendor?.name ? (
          <span className="text-ink">{row.vendor.name}</span>
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
      render: () => NOT_RECORDED,
    },
    { key: "taxTotal", header: "Tax", align: "right", render: () => NOT_RECORDED },
    {
      key: "category",
      header: "Category",
      render: (row) =>
        row.category ? <span className="text-body">{row.category}</span> : <span className="text-muted">—</span>,
    },
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
      render: (row) => <BillStatusBadge status={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchases"
        subtitle="Every bill recorded in the selected period, with what has been paid and what is still owed."
      />


      <div className="space-y-5">
        <ReportNote
          title="How this report is calculated"
          items={[
            "A bill stores one total, so that total is shown as both the subtotal and the total.",
            "A bill has no discount or tax column, so those two columns are shown as Not recorded rather than as zero.",
          ]}
        />

        <ReportFilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search by bill number—…"
          searchLabel="Search bills by number"
          showDateRange
          range={range}
          onRangeChange={(next) => {
            setRange(next);
            setPage(1);
          }}
          rangeError={rangeIsValid ? "" : "The 'from' date must be on or before the 'to' date."}
          fields={[
            {
              key: "vendorId",
              label: "Vendor",
              value: vendorId,
              onChange: (value) => {
                setVendorId(value);
                setPage(1);
              },
              options: vendorOptions,
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
              options: PURCHASE_SORT_OPTIONS,
              width: "w-52",
            },
          ]}
          onReset={() => {
            setRange({ preset: "month", ...presetRange("month") });
            setVendorId("");
            setPaymentStatus("");
            setSearch("");
            setSort("dateDesc");
            setPage(1);
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
            title="Bills in this range"
            description="Sorted by the option chosen in the filter bar."
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
                title="No bills in this range"
                description="Try a wider date range, a different vendor or a different payment status."
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
