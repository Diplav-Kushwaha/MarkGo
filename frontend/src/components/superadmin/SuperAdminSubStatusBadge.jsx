/**
 * Status pill for subscription and payment states on the Super Admin console.
 * ACTIVE and PAID are green, EXPIRED and FAILED are red, PENDING is amber,
 * CANCELLED is grey.
 */
const TONES = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  EXPIRED: "bg-red-50 text-red-700 ring-red-200",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
};

const DOTS = {
  ACTIVE: "bg-emerald-500",
  PAID: "bg-emerald-500",
  EXPIRED: "bg-red-500",
  FAILED: "bg-red-500",
  PENDING: "bg-amber-500",
  CANCELLED: "bg-slate-400",
};

export default function SuperAdminSubStatusBadge({ status, className = "" }) {
  const key = status || "CANCELLED";
  const label = String(key).charAt(0) + String(key).slice(1).toLowerCase();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        TONES[key] || TONES.CANCELLED
      } ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${DOTS[key] || DOTS.CANCELLED}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
