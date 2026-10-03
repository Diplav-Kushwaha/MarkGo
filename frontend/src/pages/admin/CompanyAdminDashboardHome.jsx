import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  FileText,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { getDashboard } from "../../api/dashboardAdminApi";
import { formatCurrency, formatDate } from "../../lib/format";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  SkeletonStatCards,
  StatCard,
  StatusBadge,
} from "../../components/ui";

const EMPTY_CARDS = {
  totalReceivable: 0,
  totalPayable: 0,
  thisMonthSales: 0,
  thisMonthExpenses: 0,
};

export default function CompanyAdminDashboardHome() {
  const navigate = useNavigate();
  const [cards, setCards] = useState(EMPTY_CARDS);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await getDashboard();
        if (cancelled) return;

        if (res.success) {
          setCards({ ...EMPTY_CARDS, ...(res.data.cards || {}) });
          setRecentInvoices(res.data.recentInvoices || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const statCards = [
    {
      label: "Total receivable",
      value: formatCurrency(cards.totalReceivable),
      hint: "Outstanding across all invoices",
      icon: Clock,
      tone: "warning",
    },
    {
      label: "Total payable",
      value: formatCurrency(cards.totalPayable),
      hint: "Owed across all bills",
      icon: Wallet,
      tone: "danger",
    },
    {
      label: "This month sales",
      value: formatCurrency(cards.thisMonthSales),
      hint: "Invoiced so far this month",
      icon: TrendingUp,
      tone: "success",
    },
    {
      label: "This month expenses",
      value: formatCurrency(cards.thisMonthExpenses),
      hint: "Bills recorded so far this month",
      icon: ArrowDownRight,
      tone: "info",
    },
  ];

  const columns = [
    {
      key: "invoiceNumber",
      header: "Invoice",
      width: "18%",
      render: (row) => (
        <div className="font-medium text-ink">{row.invoiceNumber}</div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) => row.customer?.name || <span className="text-muted">—</span>,
    },
    {
      key: "invoiceDate",
      header: "Issue date",
      render: (row) => formatDate(row.invoiceDate),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} dot />,
    },
    {
      key: "grandTotal",
      header: "Grand total",
      align: "right",
      render: (row) => <span className="font-medium text-ink">{formatCurrency(row.grandTotal)}</span>,
    },
    {
      key: "amountDue",
      header: "Amount due",
      align: "right",
      render: (row) => (
        <span
          className={
            Number(row.amountDue) > 0 ? "font-medium text-danger" : "text-muted"
          }
        >
          {formatCurrency(row.amountDue)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="What you are owed, what you owe, and this month's activity at a glance."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/admin/customers")}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add customer
            </Button>
            <Button onClick={() => navigate("/admin/invoices/new")}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              New invoice
            </Button>
          </>
        }
      />

      {error && (
        <Alert className="mb-4" title="Could not load the dashboard">
          {error}
        </Alert>
      )}

      <div className="space-y-6">
        {loading ? (
          <SkeletonStatCards count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
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
            title="Recent invoices"
            description={
              loading
                ? "Loading your latest invoices…"
                : `Latest ${recentInvoices.length} invoice${recentInvoices.length === 1 ? "" : "s"}`
            }
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/invoices")}>
                View all
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            }
          />

          <DataTable
            contained
            columns={columns}
            rows={recentInvoices}
            loading={loading}
            onRowClick={(row) => navigate(`/admin/invoices/${row.id}`)}
            empty={
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Create your first invoice to start tracking receivables."
                action={
                  <Button onClick={() => navigate("/admin/invoices/new")}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New invoice
                  </Button>
                }
              />
            }
          />
        </Card>
      </div>
    </>
  );
}
