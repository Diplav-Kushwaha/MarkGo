import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  Store,
} from "lucide-react";
import { getVendorsReport } from "../../../api/reportAdminApi";
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
 * 8. ALL VENDORS
 *
 * The mirror of the All customers report, for what the company buys: every
 * vendor with bills in the selected range, with what they billed, what was paid
 * and what is still owed.
 *
 * A bill has no cancelled status in the schema, so no bill is excluded from
 * these totals — the page says so rather than implying a rule that does not
 * exist.
 */

const PAGE_SIZE = 10;

const EMPTY_SUMMARY = {
  totalVendors: 0,
  totalBilled: 0,
  totalPaid: 0,
  totalDue: 0,
  totalBills: 0,
  matchingPartiesInCompany: 0,
};

export default function VendorsReportPage() {
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

  const { data, loading, error } = useReportData({ fetcher: getVendorsReport, query });

  const rows = data?.rows || [];
  const summary = { ...EMPTY_SUMMARY, ...(data?.summary || {}) };
  const pagination = data?.pagination || { total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };

  const rangeIsValid = !range.from || !range.to || range.from <= range.to;

  const summaryCards = [
    {
      label: "Total vendors",
      value: String(summary.totalVendors || 0),
      hint: "With bills in the selected range",
      icon: Store,
      tone: "primary",
    },
    {
      label: "Total billed",
      value: formatCurrency(summary.totalBilled),
      hint: `${summary.totalBills || 0} bill(s) recorded`,
      icon: FileText,
      tone: "info",
    },
    {
      label: "Total paid",
      value: formatCurrency(summary.totalPaid),
      hint: "Payments recorded in the range",
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Total due",
      value: formatCurrency(summary.totalDue),
      hint: "Still owed on these bills",
      icon: Clock,
      tone: "danger",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Vendor",
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-ink">{row.name}</div>
          {row.companyName && <div className="text-xs text-muted">{row.companyName}</div>}
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (row) => row.phone || <span className="text-muted">—</span> },
    { key: "email", header: "Email", render: (row) => row.email || <span className="text-muted">—</span> },
    { key: "billCount", header: "Bills", align: "right", render: (row) => row.billCount },
    { key: "billed", header: "Billed", align: "right", render: (row) => formatCurrency(row.billed) },
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
      key: "lastBillDate",
      header: "Last bill",
      render: (row) =>
        row.lastBillDate ? (
          <span className="text-body">{formatDate(row.lastBillDate)}</span>
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
        title="All vendors"
        subtitle="Every vendor with bills in the selected period, with what they billed, what was paid and what is still owed."
      />


      <div className="space-y-5">
        <ReportFilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search by name, email or phone—…"
          searchLabel="Search vendors"
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
            "The totals are scoped to the selected date range. Leave both dates empty to cover every bill the company has recorded.",
            "A bill has no cancelled status in the schema, so no bill is excluded from these totals.",
            "Billed is the total of the bills recorded in the range; Paid is the payments recorded in the range, which may belong to a bill from an earlier period.",
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
            title="Vendors"
            description="Only vendors with bills in the selected range are listed. The sort controls sit in the filter bar."
          />
          <ReportTable
            columns={columns}
            rows={rows}
            loading={loading}
            empty={
              <EmptyState
                icon={Store}
                title="No vendors match these filters"
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
