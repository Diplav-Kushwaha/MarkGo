import { useEffect, useMemo, useState } from "react";
import { Package, Wrench } from "lucide-react";
import { getCategoryOptions } from "../../../api/categoryAdminApi";
import { getServicesReport } from "../../../api/reportAdminApi";
import { formatCurrency } from "../../../lib/format";
import {
  AVAILABILITY_LABELS,
  CATALOGUE_SORT_OPTIONS,
  CATALOGUE_STATUS_FILTERS,
  TAX_MODE_LABELS,
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
import ReportFilterBar, { ReportNote, ReportTable, SummaryCardsSkeleton } from "../../../components/admin/reportFilterBar";
import useReportData from "../../../components/admin/useReportData";

/**
 * 10. ALL SERVICES
 *
 * The service catalogue as price and availability. A service has no stock and no
 * purchase price, so there is deliberately no quantity or cost column here —
 * showing one would mean inventing data the schema does not hold.
 */

const PAGE_SIZE = 10;

const EMPTY_SUMMARY = {
  totalServices: 0,
  availableServices: 0,
  unavailableServices: 0,
};

export default function ServicesReportPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
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
        setCategories(list.filter((entry) => entry.type === "SERVICE"));
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
      sort,
      page,
      pageSize,
    }),
    [search, category, status, sort, page, pageSize]
  );

  const { data, loading, error } = useReportData({ fetcher: getServicesReport, query });

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
      label: "Total services",
      value: String(summary.totalServices || 0),
      hint: "Matching these filters",
      icon: Wrench,
      tone: "primary",
    },
    {
      label: "Available",
      value: String(summary.availableServices || 0),
      hint: "Currently offered for sale",
      icon: Package,
      tone: "success",
    },
    {
      label: "Not available",
      value: String(summary.unavailableServices || 0),
      hint: "Not offered for sale",
      icon: Package,
      tone: "muted",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Service",
      render: (row) => <span className="font-medium text-ink">{row.name}</span>,
    },
    { key: "serviceCode", header: "Code", render: (row) => row.serviceCode || <span className="text-muted">—</span> },
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
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge status={row.status} label={AVAILABILITY_LABELS[row.status] || row.status} dot />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="All services"
        subtitle="The service catalogue as price and availability, for the services the company offers."
      />


      <div className="space-y-5">
        <ReportNote
          title="What this report covers"
          items={[
            "A service has no stock and no purchase price, so there is no quantity or cost column here.",
            "The summary cards describe the filtered set, so they move with the filters.",
          ]}
        />

        <ReportFilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search by name or code—…"
          searchLabel="Search services"
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
            setSort("newest");
            setPage(1);
          }}
        />

        {error && (
          <ReportNote tone="error" title="This report could not be loaded" items={[error]} />
        )}

        {loading ? (
          <SummaryCardsSkeleton count={3} />
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

        <Card>
          <CardHeader title="Services" description="Filtered by the controls in the filter bar." />
          <ReportTable
            columns={columns}
            rows={rows}
            loading={loading}
            empty={
              <EmptyState
                icon={Wrench}
                title="No services match these filters"
                description="Try a different search term, category or status."
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
