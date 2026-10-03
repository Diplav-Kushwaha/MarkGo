/**
 * Company status badge with the labels users actually recognise.
 *
 * SUSPENDED is shown as "Inactive", because that is what it means to the
 * company using it. Raw enum values never reach the screen.
 */
const TONES = {
  ACTIVE: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", label: "Active" },
  SUSPENDED: { chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", label: "Inactive" },
  PENDING_PAYMENT: {
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
    label: "Payment pending",
  },
  CANCELLED: { chip: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400", label: "Cancelled" },
};

export default function CompanyStatusBadge({ status, className = "" }) {
  const key = status || "ACTIVE";
  const tone = TONES[key] || TONES.CANCELLED;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone.chip} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
      {tone.label}
    </span>
  );
}
