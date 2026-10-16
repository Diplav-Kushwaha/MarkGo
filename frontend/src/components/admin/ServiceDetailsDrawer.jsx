import { useEffect, useState } from "react";
import { Pencil, Wrench } from "lucide-react";
import { getServiceById } from "../../api/serviceAdminApi";
import { formatCurrency, formatDate } from "../../lib/format";
import { SERVICE_STATUS_LABELS, TAX_MODE_LABELS } from "../../lib/serviceConstants";
import { Button, Drawer, Skeleton, StatusBadge } from "../ui";

/**
 * Read-only details drawer for the new Services logic.
 *
 * The drawer receives the list row it was opened from, so the details render
 * immediately and Edit keeps working even if the details request fails. It then
 * fetches the single-service endpoint to pick up the freshly stored values,
 * including the unit/category relations. That fetch is the only API call this
 * view makes and it is a GET — nothing here can mutate data.
 *
 * There is deliberately no stock and no profit/loss block: services have
 * neither. Missing optional values render as a dash, so older services that
 * predate the unit/category relations open without crashing.
 *
 * The shared `ItemDetailsDrawer` and the product drawer are left untouched.
 */

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-right text-sm text-ink">{value}</dd>
    </div>
  );
}

/** Missing optional values render as a dash rather than an empty cell. */
function orDash(value) {
  if (value === null || value === undefined || value === "") return <span className="text-muted">—</span>;
  return value;
}

/** The unit as "Kilogram (kg)", falling back to whichever part exists. */
function formatUnit(unitRef) {
  if (!unitRef) return null;
  const name = unitRef.fullName || unitRef.name || "";
  return name && unitRef.shortName ? `${name} (${unitRef.shortName})` : name || unitRef.shortName || null;
}

/** Inline label such as "₹150.00 incl. tax" for a price plus its tax mode. */
function PriceWithMode({ amount, mode }) {
  return (
    <span>
      {formatCurrency(amount)} <span className="text-xs text-muted">{TAX_MODE_LABELS[mode] || "no tax"}</span>
    </span>
  );
}

export default function ServiceDetailsDrawer({ service, onClose, onEdit }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      setLoading(true);
      setError("");
      try {
        const res = await getServiceById(service.id);
        if (cancelled) return;
        if (!res.success || !res.data) {
          setError("Could not load the service details.");
          return;
        }
        setDetails(res.data);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || "Could not load the service details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [service.id]);

  // Prefer the freshly fetched payload, but fall back to the list row so the
  // details section still renders if the request failed.
  const item = details || service;

  return (
    <Drawer
      isOpen
      onClose={onClose}
      size="lg"
      title={item?.name || "Service"}
      description="Service details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              const target = details || service;
              onClose();
              onEdit?.(target);
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit service
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={item?.status}
            label={SERVICE_STATUS_LABELS[item?.status] || item?.status}
            dot
          />
          <StatusBadge status="OPEN" label="Service" />
        </div>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Details</h3>
          <dl>
            <Row label="Service code" value={orDash(item?.serviceCode)} />
            <Row label="Category" value={item?.categoryRef ? item.categoryRef.name : orDash(null)} />
            <Row label="Unit" value={orDash(formatUnit(item?.unitRef))} />
            <Row
              label="Selling price"
              value={<PriceWithMode amount={item?.sellingPrice} mode={item?.sellingPriceTaxMode} />}
            />
            <Row
              label="Tax rate"
              value={item?.taxRate !== null && item?.taxRate !== undefined && item?.taxRate !== "" ? `${Number(item.taxRate)}%` : orDash(null)}
            />
            <Row label="Created" value={item?.createdAt ? formatDate(item.createdAt) : orDash(null)} />
          </dl>

          {item?.description && (
            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Description</h4>
              <p className="whitespace-pre-line rounded-tile border border-primary-100 bg-primary-50/50 p-3 text-sm text-body">
                {item.description}
              </p>
            </div>
          )}
        </section>

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {!loading && error && (
            <div className="rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">
            {error} The details shown above are from the list.
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
          Service ID: <span className="font-mono">{item?.id}</span>
        </p>
      </div>
    </Drawer>
  );
}
