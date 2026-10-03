import { AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import StatCard from "../ui/StatCard";

const EMPTY_SUMMARY = {
  totalInvoiced: 0,
  totalPaid: 0,
  totalOutstanding: 0,
  outstandingCount: 0,
  overdueCount: 0,
  overdueAmount: 0,
};

export default function InvoiceSummaryCards({ summary = EMPTY_SUMMARY }) {
  const data = { ...EMPTY_SUMMARY, ...summary };

  const cards = [
    {
      label: "Total invoiced",
      value: formatCurrency(data.totalInvoiced),
      hint: "Across all invoices",
      icon: FileText,
      tone: "primary",
    },
    {
      label: "Total paid",
      value: formatCurrency(data.totalPaid),
      hint: "Payments received",
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Outstanding",
      value: formatCurrency(data.totalOutstanding),
      hint: `${data.outstandingCount} invoice${data.outstandingCount === 1 ? "" : "s"} awaiting payment`,
      icon: Clock,
      tone: "warning",
    },
    {
      label: "Overdue",
      value: `${data.overdueCount}`,
      hint: formatCurrency(data.overdueAmount),
      icon: AlertTriangle,
      tone: "danger",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
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
  );
}
