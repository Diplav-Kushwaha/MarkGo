import { useEffect, useState } from "react";
import { AlertTriangle, Package, Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { getProductById } from "../../api/productAdminApi";
import { formatCurrency, formatDate } from "../../lib/format";
import { LOW_STOCK_THRESHOLD, PRODUCT_STATUS_LABELS, TAX_MODE_LABELS } from "../../lib/productConstants";
import { Button, Drawer, Skeleton, StatusBadge } from "../ui";

/**
 * Read-only details drawer for the new Products logic, including the
 * profit/loss breakdown the backend computes.
 *
 * The drawer receives the list row it was opened from, so the details render
 * immediately and Edit keeps working even if the details request fails. It then
 * fetches the single-product endpoint to pick up the `profitLoss` object, which
 * the list does not return. That fetch is the only API call this view makes and
 * it is a GET — nothing here can mutate data.
 *
 * The shared `ItemDetailsDrawer` is left untouched for the Services page.
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

/** Inline label such as "₹150.00 incl. tax" for a price plus its tax mode. */
function PriceWithMode({ amount, mode }) {
  return (
    <span>
      {formatCurrency(amount)} <span className="text-xs text-muted">{TAX_MODE_LABELS[mode] || "no tax"}</span>
    </span>
  );
}

function StockBadge({ quantity }) {
  if (quantity <= 0) {
    return (
      <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-danger-line">
        Out of stock
      </span>
    );
  }
  if (quantity <= LOW_STOCK_THRESHOLD) {
    return (
      <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-warning-line">
        Low stock
      </span>
    );
  }
  return null;
}

function ProfitLossFigure({ label, value, emphasis = false, hint }) {
  const isNegative = Number(value) < 0;
  const isZero = Number(value) === 0;

  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-xs text-muted">
        {label}
        {hint && <span className="mt-0.5 block text-[11px] text-muted/80">{hint}</span>}
      </dt>
      <dd
        className={
          emphasis
            ? isZero
              ? "text-sm font-medium text-body"
              : isNegative
                ? "text-sm font-semibold text-red-700"
                : "text-sm font-semibold text-green-700"
            : "text-sm text-ink"
        }
      >
        {formatCurrency(value)}
      </dd>
    </div>
  );
}

/**
 * "Total for current stock" block.
 *
 * Colour, wording and icon follow the sign of the total: green + "Profit" when
 * positive, red + "Loss" when negative, neutral grey when exactly zero.
 */
function TotalsBlock({ totals }) {
  const value = Number(totals?.totalProfitLoss) || 0;
  const isProfit = value > 0;
  const isLoss = value < 0;
  const Icon = isLoss ? TrendingDown : TrendingUp;

  const containerClass = isLoss
    ? "border-danger-line bg-danger-soft"
    : isProfit
      ? "border-success-line bg-success-soft"
      : "border-primary-100 bg-primary-50/60";

  const valueClass = isLoss ? "text-red-700" : isProfit ? "text-green-700" : "text-body";

  return (
    <div className={`rounded-tile border p-4 ${containerClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total for current stock</p>
          <p className={`mt-1 flex items-center gap-1.5 text-xl font-semibold tracking-tight ${valueClass}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {isLoss ? "Loss" : isProfit ? "Profit" : "No profit"} {formatCurrency(Math.abs(value))}
          </p>
        </div>
      </div>

      <dl className="mt-3">
        <div className="flex items-center justify-between gap-4 py-1.5">
          <dt className="text-xs text-muted">Total selling value</dt>
          <dd className="text-sm text-ink">{formatCurrency(totals?.totalSellingValue ?? 0)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-1.5">
          <dt className="text-xs text-muted">Total cost value</dt>
          <dd className="text-sm text-ink">{formatCurrency(totals?.totalCostValue ?? 0)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-1.5">
          <dt className="text-xs text-muted">Total profit / loss</dt>
          <dd className="text-sm font-medium text-ink">{formatCurrency(value)}</dd>
        </div>
      </dl>

      <p className="mt-3 border-t border-line/60 pt-2.5 text-[11px] leading-relaxed text-muted">
        Profit/loss is calculated excluding tax; tax collected and paid are shown separately.
      </p>
    </div>
  );
}

export default function ProductDetailsDrawer({ product, onClose, onEdit }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      setLoading(true);
      setError("");
      try {
        const res = await getProductById(product.id);
        if (cancelled) return;
        if (!res.success || !res.data) {
          setError("Could not load the profit/loss breakdown.");
          return;
        }
        setDetails(res.data);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || "Could not load the profit/loss breakdown.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  // Prefer the freshly fetched payload, but fall back to the list row so the
  // details section still renders if the request failed.
  const item = details || product;
  const profitLoss = item?.profitLoss;
  const perUnit = profitLoss?.perUnit;
  const totals = profitLoss?.totals;
  const hasCostPrice = Boolean(profitLoss?.hasCostPrice);
  const quantity = Number(item?.quantity) || 0;
  const purchasePrice = item?.purchasePrice;

  return (
    <Drawer
      isOpen
      onClose={onClose}
      size="lg"
      title={item?.name || "Product"}
      description="Product details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              const target = details || product;
              onClose();
              onEdit?.(target);
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit product
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={item?.status}
            label={PRODUCT_STATUS_LABELS[item?.status] || item?.status}
            dot
          />
          <StatusBadge status="OPEN" label={item?.type === "SERVICE" ? "Service" : "Product"} />
        </div>

        {/* ---- Details ------------------------------------------------------ */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Details</h3>
          <dl>
            <Row label="Product code" value={orDash(item?.productCode)} />
            <Row label="Category" value={item?.categoryRef ? item.categoryRef.name : orDash(null)} />
            <Row
              label="Unit"
              value={
                item?.unitRef ? (
                  `${item.unitRef.fullName || item.unitRef.name}${item.unitRef.shortName ? ` (${item.unitRef.shortName})` : ""}`
                ) : (
                  orDash(null)
                )
              }
            />
            <Row label="Brand / manufacturer" value={orDash(item?.brand)} />
            <Row label="HSN / SAC code" value={orDash(item?.hsnSacCode)} />
            <Row
              label="Quantity"
              value={
                <span className="inline-flex items-center">
                  {quantity}
                  <StockBadge quantity={quantity} />
                </span>
              }
            />
            <Row label="Selling price" value={<PriceWithMode amount={item?.sellingPrice} mode={item?.sellingPriceTaxMode} />} />
            <Row label="Discount" value={item?.discountPercent != null && item?.discountPercent !== "" ? `${Number(item.discountPercent)}%` : orDash(null)} />
            <Row label="Tax rate" value={item?.taxRate != null && item?.taxRate !== "" ? `${Number(item.taxRate)}%` : orDash(null)} />
            <Row
              label="Purchase price"
              value={
                purchasePrice === null || purchasePrice === undefined
                  ? <span className="text-muted">Not added</span>
                  : <PriceWithMode amount={purchasePrice} mode={item?.purchasePriceTaxMode} />
              }
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

        {/* ---- Profit / loss ------------------------------------------------ */}
        <section className="border-t border-line pt-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Profit / loss</h3>

          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && !profitLoss && (
            <p className="text-sm text-muted">Profit/loss is not available for this product.</p>
          )}

          {!loading && !error && profitLoss && !hasCostPrice && (
            <div className="rounded-tile border border-primary-100 bg-primary-50/50 px-4 py-3 text-sm text-body">
              Add a purchase price to see profit/loss
            </div>
          )}

          {!loading && !error && profitLoss && hasCostPrice && (
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Per unit</h4>
                <dl>
                  <ProfitLossFigure label="Selling price (excl. tax, after discount)" value={perUnit?.discountedSellingBase ?? 0} />
                  <ProfitLossFigure label="Cost price (excl. tax)" value={perUnit?.costBase ?? 0} />
                  <ProfitLossFigure label="Tax collected on sale" value={perUnit?.sellingTax ?? 0} hint="Output tax" />
                  <ProfitLossFigure label="Tax paid on purchase" value={perUnit?.costTax ?? 0} hint="Input tax" />
                  <ProfitLossFigure label="Net tax payable" value={perUnit?.netTaxPayable ?? 0} />
                  <ProfitLossFigure
                    label="Profit / loss per unit"
                    value={perUnit?.profitLossPerUnit ?? 0}
                    emphasis
                  />
                  <ProfitLossFigure label="Margin" value={`${Number(perUnit?.marginPercent) || 0}%`} />
                </dl>
              </div>

              <TotalsBlock totals={totals} />
            </div>
          )}
        </section>

        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Package className="h-3.5 w-3.5" aria-hidden="true" />
          Product ID: <span className="font-mono">{item?.id}</span>
        </p>

        {hasCostPrice && Number(totals?.totalProfitLoss) < 0 && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            This product currently sells below cost.
          </p>
        )}
      </div>
    </Drawer>
  );
}
