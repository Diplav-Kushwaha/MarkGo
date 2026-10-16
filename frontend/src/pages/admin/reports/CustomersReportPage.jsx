import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  Users,
} from "lucide-react";
import { getCustomersReport } from "../../../api/reportAdminApi";
import { formatCurrency, formatDate } from "../../../lib/format";
import {
  DUES_FILTERS,
  PARTY_SORT_DIRECTION_OPTIONS,
  PARTY_SORT_FIELD_OPTIONS,
} from "../../../lib/reportConstants";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
  StatusBadge,
} from "../../../components/ui";
import ReportFilterBar, { ReportNote, ReportTable, SummaryCardsSkeleton, } from "../../../components/admin/reportFilterBar";
import useReportData from "../../../components/admin/useReportData";

/**
 * 7. ALL CUSTOMERS
 *
 * Every customer with sales in the selected range, with what they were billed,
 * what they have paid and what they still owe.
 *
 * "Total received" is the money actually recorded against their invoices in the
 * range, which is not the same number as the invoice's stored `amountPaid` — a
 * payment recorded in March against a February invoice belongs to March. The
 * page states which of the two each column is, so the figures cannot be
 * misread.
 *
 * "Total due" is the outstanding amount on the invoices issued in the range.
 * Draft and cancelled invoices are excluded, the same rule the sales report
 * uses.
 */

const PAGE_SIZE = 10;

const EMPTY_SUMMARY = {
  totalCustomers: 0,
  totalBilled: 0,
  totalReceived: 0,
  totalDue: 0,
  totalInvoices: 0,
  matchingPartiesInCompany: 0,
};

export default function CustomersReportPage() {
  const [search, setSearch] = useState("");
  const [hasDues, setHasDues] = useState("");
  const [range, setRange] = useState({ preset: "custom", from: "", to: "" });
  const [sortField, setSortField] = useState("name");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const query = useMemo(
    () => ({
      search: search.trim() || undefined,
      hasDues: hasDues || undefined,
      from: range.from || undefined,
      to: range.to || undefined,
      sortField,
      order,
      page,
      pageSize,
    }),
    [search, hasDues, range, sortField, order, page, pageSize]
  );

  const { data, loading, error } = useReportData({ fetcher: getCustomersReport, query });

  const rows = data?.rows || [];
  const summary = { ...EMPTY_SUMMARY, ...(data?.summary || {}) };
  const pagination = data?.pagination || { total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };

  const rangeIsValid = !range.from || !range.to || range.from <= range.to;

  const summaryCards = [
    {
      label: "Total customers",
      value: String(summary.totalCustomers || 0),
      hint: "With sales in the selected range",
      icon: Users,
      tone: "primary",
    },
    {
      label: "Total billed",
      value: formatCurrency(summary.totalBilled),
      hint: `${summary.totalInvoices || 0} invoice(s) issued`,
      icon: FileText,
      tone: "info",
    },
    {
      label: "Total received",
      value: formatCurrency(summary.totalReceived),
      hint: "Payments recorded in the range",
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Total due",
      value: formatCurrency(summary.totalDue),
      hint: "Still owed on these invoices",
      icon: Clock,
      tone: "danger",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Customer",
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-ink">{row.name}</div>
          {row.companyName && <div className="text-xs text-muted">{row.companyName}</div>}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => row.phone || <span className="text-muted">—</span>,
    },
    {
      key: "email",
      header: "Email",
      render: (row) => row.email || <span className="text-muted">—</span>,
    },
    { key: "invoiceCount", header: "Invoices", align: "right", render: (row) => row.invoiceCount },
    { key: "billed", header: "Billed", align: "right", render: (row) => formatCurrency(row.billed) },
    {
      key: "received",
      header: "Received",
      align: "right",
      render: (row) => <span className="text-success">{formatCurrency(row.received)}</span>,
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
      key: "lastInvoiceDate",
      header: "Last invoice",
      render: (row) =>
        row.lastInvoiceDate ? (
          <span className="text-body">{formatDate(row.lastInvoiceDate)}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.status ? (
          <StatusBadge status={row.status} label={row.status === "ACTIVE" ? "Active" : "Inactive"} dot />
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="All customers"
        subtitle="Every customer with sales in the selected period, with what they were billed, what they paid and what they still owe."
      />


      <div className="space-y-5">
        <ReportFilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search by name, email or phone—…"
          searchLabel="Search customers"
          showDateRange
          range={range}
          onRangeChange={(next) => {
            setRange(next);
            setPage(1);
          }}
          rangeError={rangeIsValid ? "" : "The 'from' date must be on or before the 'to' date."}
          fields={[
            {
              key: "hasDues",
              label: "Dues",
              value: hasDues,
              onChange: (value) => {
                setHasDues(value);
                setPage(1);
              },
              options: DUES_FILTERS,
              width: "w-40",
            },
            {
              key: "sortField",
              label: "Sort by",
              value: sortField,
              onChange: (value) => {
                setSortField(value);
                setPage(1);
              },
              options: PARTY_SORT_FIELD_OPTIONS,
              width: "w-48",
            },
            {
              key: "order",
              label: "Order",
              value: order,
              onChange: setOrder,
              options: PARTY_SORT_DIRECTION_OPTIONS,
              width: "w-36",
            },
          ]}
          onReset={() => {
            setSearch("");
            setHasDues("");
            setRange({ preset: "custom", from: "", to: "" });
            setSortField("name");
            setOrder("asc");
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
          <ReportNote tone="error" title="This report could not be loaded" items={[error]} />
        )}

        <ReportNote
          title="What these totals cover"
          items={[
            "The totals are scoped to the selected date range. Leave both dates empty to cover every invoice the company has issued.",
            "Billed is the subtotal-plus-tax-and-discount total of the invoices issued in the range; Received is the payments recorded in the range, which may belong to an invoice from an earlier period.",
            "Due is what is still outstanding on the invoices issued in the range.",
            "Draft and cancelled invoices are excluded, exactly as the sales report excludes them.",
          ]}
        />

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

        <Card>
          <CardHeader
            title="Customers"
            description="Only customers with sales in the selected range are listed. The sort controls sit in the filter bar."
          />
          <ReportTable
            columns={columns}
            rows={rows}
            loading={loading}
            empty={
              <EmptyState
                icon={Users}
                title="No customers match these filters"
                description="Try a wider date range, clear the search box or reset the filters."
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
