import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  Wallet,
} from "lucide-react";
import { getTransactionsReport } from "../../../api/reportAdminApi";
import { getCustomers } from "../../../api/customerAdminApi";
import { getVendors } from "../../../api/vendorAdminApi";
import { formatCurrency, formatDate, humanize } from "../../../lib/format";
import {
  TRANSACTION_MODE_OPTIONS,
  TRANSACTION_SORT_OPTIONS,
  TRANSACTION_STATUS_OPTIONS,
  presetRange,
} from "../../../lib/reportConstants";
import {
  Alert,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
  Tabs,
} from "../../../components/ui";
import ReportFilterBar, { ReportTable, SummaryCardsSkeleton, } from "../../../components/admin/reportFilterBar";
import useReportData from "../../../components/admin/useReportData";
import StatusBadge from "../../../components/ui/StatusBadge";

/**
 * 3. ALL TRANSACTIONS
 *
 * Every money movement the company has recorded: a payment against an invoice is
 * money in, a payment against a bill is money out. The `payments` table is the
 * only record of either, and it stores an amount, a method, a free-text
 * reference, a note and the date — nothing else.
 *
 * That has two consequences this page states instead of guessing:
 *   - there is no status column, so a failed, declined or cancelled payment
 *     cannot be identified. The Failed tab is therefore hidden and no row is
 *     ever labelled failed;
 *   - there is no bank or cash account column, so the account is shown as Not
 *     recorded. Only the stored payment mode is available.
 */

const PAGE_SIZE = 10;

const EMPTY_SUMMARY = {
  totalIncoming: 0,
  totalOutgoing: 0,
  net: 0,
  failedCount: null,
  failedAmount: null,
  transactionCount: 0,
  incomingCount: 0,
  outgoingCount: 0,
};

const NOT_RECORDED = <span className="text-muted">Not recorded</span>;

export default function TransactionsReportPage() {
  const [range, setRange] = useState({ preset: "month", ...presetRange("month") });
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [mode, setMode] = useState("ALL");
  const [partyId, setPartyId] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("dateDesc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const query = useMemo(
    () => ({
      from: range.from || undefined,
      to: range.to || undefined,
      type,
      status,
      mode,
      partyId: partyId || undefined,
      search: search.trim() || undefined,
      sort,
      page,
      pageSize,
    }),
    [range, type, status, mode, partyId, search, sort, page, pageSize]
  );

  const { data, loading, error } = useReportData({ fetcher: getTransactionsReport, query });
  const customers = useReportData({ fetcher: () => getCustomers({ pageSize: 100 }), query: {} });
  const vendors = useReportData({ fetcher: () => getVendors({ pageSize: 100 }), query: {} });

  const rows = data?.rows || [];
  const summary = { ...EMPTY_SUMMARY, ...(data?.summary || {}) };
  const pagination = data?.pagination || { total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };
  const meta = data?.meta || {};
  const typeCounts = meta.typeCounts || {};

  const rangeIsValid = !range.from || !range.to || range.from <= range.to;

  const partyOptions = useMemo(() => {
    const customerList = (customers.data?.customers || []).map((customer) => ({
      value: customer.id,
      label: `Customer — ${customer.name}`,
    }));
    const vendorList = (vendors.data?.vendors || []).map((vendor) => ({
      value: vendor.id,
      label: `Vendor — ${vendor.name}`,
    }));
    return [{ value: "", label: "All parties" }, ...customerList, ...vendorList];
  }, [customers.data, vendors.data]);

  const summaryCards = [
    {
      label: "Total incoming",
      value: formatCurrency(summary.totalIncoming),
      hint: "Payments received against invoices",
      icon: ArrowDownLeft,
      tone: "success",
    },
    {
      label: "Total outgoing",
      value: formatCurrency(summary.totalOutgoing),
      hint: "Payments made against bills",
      icon: ArrowUpRight,
      tone: "danger",
    },
    {
      label: "Net",
      value: formatCurrency(summary.net),
      hint: summary.net >= 0 ? "Money in exceeds money out" : "Money out exceeds money in",
      icon: Scale,
      tone: summary.net >= 0 ? "success" : "danger",
    },
    {
      label: "Transactions",
      value: String(summary.transactionCount || 0),
      hint: "Recorded in this range",
      icon: Wallet,
      tone: "primary",
    },
  ];

  const columns = [
    { key: "paymentDate", header: "Date", render: (row) => formatDate(row.paymentDate) },
    {
      key: "reference",
      header: "Reference",
      render: (row) =>
        row.reference ? (
          <div>
            <span className="font-medium text-ink">{row.reference}</span>
            <span className="block text-xs text-muted">{row.documentType}</span>
          </div>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "partyName",
      header: "Party",
      render: (row) =>
        row.partyName ? (
          <div>
            <span className="text-ink">{row.partyName}</span>
            <span className="block text-xs text-muted">{row.partyType}</span>
          </div>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) =>
        row.direction === "INCOMING" ? (
          <span className="inline-flex items-center gap-1 text-success">
            <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Incoming
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-danger">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            Outgoing
          </span>
        ),
    },
    {
      key: "mode",
      header: "Mode",
      render: (row) => <span className="text-body">{humanize(row.mode)}</span>,
    },
    { key: "account", header: "Account", render: () => NOT_RECORDED },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => (
        <span
          className={`font-medium ${
            row.direction === "INCOMING" ? "text-success" : "text-danger"
          }`}
        >
          {row.direction === "INCOMING" ? "+" : "−"}
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: () => <StatusBadge status="PAID" label="Successful" dot />,
    },
  ];

  return (
    <>
      <PageHeader
        title="All transactions"
        subtitle="Every payment the company has recorded, whether money came in against an invoice or went out against a bill."
      />


      <div className="space-y-5">
        <Alert tone="warning" title="What this report cannot show yet">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Payment records have no status field, so a failed, declined or cancelled payment
              cannot be identified. Every recorded payment is a successful one, and the Failed
              tab is not offered.
            </li>
            <li>
              Payment records have no bank or cash account field, so the account is shown as Not
              recorded. Only the stored payment mode is available.
            </li>
          </ul>
        </Alert>

        <ReportFilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search by reference, note or party—…"
          searchLabel="Search transactions"
          showDateRange
          range={range}
          onRangeChange={(next) => {
            setRange(next);
            setPage(1);
          }}
          rangeError={rangeIsValid ? "" : "The 'from' date must be on or before the 'to' date."}
          fields={[
            {
              key: "mode",
              label: "Mode",
              value: mode,
              onChange: (value) => {
                setMode(value);
                setPage(1);
              },
              options: TRANSACTION_MODE_OPTIONS,
              width: "w-40",
            },
            {
              key: "partyId",
              label: "Party",
              value: partyId,
              onChange: (value) => {
                setPartyId(value);
                setPage(1);
              },
              options: partyOptions,
              width: "w-56",
            },
            {
              key: "status",
              label: "Status",
              value: status,
              onChange: (value) => {
                setStatus(value);
                setPage(1);
              },
              options: TRANSACTION_STATUS_OPTIONS,
              width: "w-40",
            },
            {
              key: "sort",
              label: "Sort",
              value: sort,
              onChange: (value) => {
                setSort(value);
                setPage(1);
              },
              options: TRANSACTION_SORT_OPTIONS,
              width: "w-48",
            },
          ]}
          onReset={() => {
            setRange({ preset: "month", ...presetRange("month") });
            setType("ALL");
            setStatus("ALL");
            setMode("ALL");
            setPartyId("");
            setSearch("");
            setSort("dateDesc");
            setPage(1);
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
            title="Transactions"
            description="Money movements recorded in the selected range."
            actions={
              meta.failedSupported ? null : (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  No failed status is stored
                </span>
              )
            }
          />

          {/* The direction tabs mirror the type filter. Failed is deliberately
              absent: the data cannot support it. */}
          <div className="px-5 pt-4">
            <Tabs
              label="Transaction direction"
              value={type}
              onChange={(value) => {
                setType(value);
                setPage(1);
              }}
              items={[
                { value: "ALL", label: "All", count: typeCounts.all },
                { value: "INCOMING", label: "Incoming", count: typeCounts.incoming },
                { value: "OUTGOING", label: "Outgoing", count: typeCounts.outgoing },
              ]}
            />
          </div>

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
                icon={Wallet}
                title="No transactions in this range"
                description="Try a wider date range, a different mode or a different party."
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
