import StatusBadge from "../ui/StatusBadge";

const INVOICE_LABELS = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export default function InvoiceStatusBadge({ status, className }) {
  return <StatusBadge status={status} label={INVOICE_LABELS[status]} dot className={className} />;
}
