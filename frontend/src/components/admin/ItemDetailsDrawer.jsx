import { Package, Pencil } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { Button, Drawer, StatusBadge } from "../ui";

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-right text-sm text-ink">{value}</dd>
    </div>
  );
}

export default function ItemDetailsDrawer({ item, onClose, onEdit }) {
  if (!item) return null;

  const isService = item.type === "SERVICE";

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={item.name}
      description={isService ? "Service" : "Product"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit item
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={item.type === "SERVICE" ? "OPEN" : "PRODUCT"}
            label={item.type}
          />
          <StatusBadge status={item.status} dot />
        </div>

        <dl>
          <Row label="Selling price" value={`${formatCurrency(item.salesPrice)} / ${item.unit || "unit"}`} />
          {item.purchasePrice != null && (
            <Row label="Cost price" value={formatCurrency(item.purchasePrice)} />
          )}
          <Row label="GST rate" value={`${Number(item.taxRate) || 0}%`} />
          <Row label={isService ? "SAC code" : "HSN code"} value={(isService ? item.sacCode : item.hsnCode) || "—"} />
          <Row label="SKU" value={item.sku || "—"} />
          <Row label="Barcode" value={item.barcode || "—"} />
          <Row
            label="Category"
            value={
              item.subCategory
                ? `${item.category || "General"} · ${item.subCategory}`
                : item.category || "General"
            }
          />
          {item.brand && <Row label="Brand" value={item.brand} />}
          {item.tags && <Row label="Tags" value={item.tags} />}

          {!isService &&
            (item.trackInventory ? (
              <>
                <Row
                  label="Stock on hand"
                  value={
                    <span className={item.isLowStock ? "text-warning" : "text-ink"}>
                      {Number(item.stockQuantity) || 0} {item.unit}
                      {item.isLowStock ? " · Low" : ""}
                    </span>
                  }
                />
                <Row label="Reorder level" value={`${Number(item.reorderLevel) || 0} ${item.unit || ""}`} />
                <Row label="Backorders" value={item.allowBackorder ? "Allowed" : "Not allowed"} />
              </>
            ) : (
              <Row label="Stock tracking" value="Not tracked" />
            ))}
        </dl>

        {item.description && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Description</h3>
            <p className="whitespace-pre-line rounded-lg border border-line bg-slate-50 p-3 text-sm text-body">
              {item.description}
            </p>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Package className="h-3.5 w-3.5" aria-hidden="true" />
          Item ID: <span className="font-mono">{item.id}</span>
        </p>
      </div>
    </Drawer>
  );
}
