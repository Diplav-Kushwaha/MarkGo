import StatusBadge from "../ui/StatusBadge";

export default function BillStatusBadge({ status, className }) {
  return <StatusBadge status={status} dot className={className} />;
}
