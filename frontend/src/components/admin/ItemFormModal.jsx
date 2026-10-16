import { useState } from "react";
import { Boxes, Wrench } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button, Input, Modal, Select, Textarea } from "../ui";

const TAX_RATES = [0, 5, 12, 18, 28];

// Shared field sizing for this form. The base Input/Select are h-9; Tailwind
// emits h-10 after h-9, so this override wins without touching the shared
// component used by every other form.
const CONTROL = "h-10";

const DISCOUNT_TYPES = [
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "FIXED", label: "Fixed amount" },
];

const EMPTY_ITEM = {
  type: "PRODUCT",
  name: "",
  sku: "",
  barcode: "",
  category: "",
  subCategory: "",
  brand: "",
  tags: "",
  hsnCode: "",
  sacCode: "",
  taxRate: 18,
  isPriceInclusiveTax: false,
  salesPrice: "",
  purchasePrice: "",
  discountType: "",
  discountValue: "",
  unit: "pcs",
  trackInventory: true,
  openingStock: "0",
  reorderLevel: "5",
  allowBackorder: false,
  description: "",
};

function validate(values) {
  const errors = {};

  if (!values.name.trim()) errors.name = "Item name is required.";
  else if (values.name.trim().length < 2) errors.name = "Must be at least 2 characters.";

  if (!values.unit.trim()) errors.unit = "Unit is required.";

  if (values.salesPrice === "" || Number.isNaN(Number(values.salesPrice))) {
    errors.salesPrice = "Enter a selling price.";
  } else if (Number(values.salesPrice) < 0) {
    errors.salesPrice = "Price cannot be negative.";
  }

  if (values.purchasePrice !== "" && Number(values.purchasePrice) < 0) {
    errors.purchasePrice = "Price cannot be negative.";
  }

  return errors;
}

function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label
      className={cn(
        "flex items-start gap-2.5 text-sm",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-line-strong text-primary-600 focus:ring-2 focus:ring-primary-600/30"
      />
      <span>
        <span className="font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export default function ItemFormModal({
  isOpen,
  onClose,
  onSubmit,
  item,
  saving = false,
  serverError = "",
  fixedType,
}) {
  const isEdit = Boolean(item);
  // fixedType locks the type on the split catalogue pages; without it the
  // classification picker below stays available.
  const initialType = fixedType || item?.type || "PRODUCT";
  // Mounted only while open, so initial values come straight from props.
  const [values, setValues] = useState(() =>
    isEdit
      ? {
          type: initialType,
          name: item.name || "",
          sku: item.sku || "",
          barcode: item.barcode || "",
          category: item.category || "",
          subCategory: item.subCategory || "",
          brand: item.brand || "",
          tags: item.tags || "",
          hsnCode: item.hsnCode || "",
          sacCode: item.sacCode || "",
          taxRate: Number(item.taxRate) || 0,
          isPriceInclusiveTax: Boolean(item.isPriceInclusiveTax),
          salesPrice: item.salesPrice !== null && item.salesPrice !== undefined ? String(item.salesPrice) : "",
          purchasePrice:
            item.purchasePrice !== null && item.purchasePrice !== undefined ? String(item.purchasePrice) : "",
          discountType: item.discountType || "",
          discountValue:
            item.discountValue !== null && item.discountValue !== undefined ? String(item.discountValue) : "",
          unit: item.unit || (initialType === "SERVICE" ? "hrs" : "pcs"),
          trackInventory: Boolean(item.trackInventory),
          openingStock:
            item.openingStock !== null && item.openingStock !== undefined ? String(item.openingStock) : "0",
          reorderLevel:
            item.reorderLevel !== null && item.reorderLevel !== undefined ? String(item.reorderLevel) : "0",
          allowBackorder: Boolean(item.allowBackorder),
          description: item.description || "",
        }
      : {
          ...EMPTY_ITEM,
          type: initialType,
          unit: initialType === "SERVICE" ? "hrs" : "pcs",
          trackInventory: initialType === "PRODUCT",
        }
  );
  const [errors, setErrors] = useState({});

  const isService = values.type === "SERVICE";
  const typeLabel = fixedType === "SERVICE" ? "service" : fixedType === "PRODUCT" ? "product" : "product or service";

  const setField = (field, value) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "" }));
  };

  const changeType = (type) => {
    setValues((previous) => ({
      ...previous,
      type,
      unit: type === "SERVICE" ? "hrs" : "pcs",
      trackInventory: type === "PRODUCT",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const found = validate(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    // Payload shape is unchanged from the previous implementation.
    await onSubmit({
      type: values.type,
      name: values.name.trim(),
      sku: values.sku.trim() || undefined,
      barcode: values.barcode.trim() || undefined,
      category: values.category.trim() || undefined,
      subCategory: values.subCategory.trim() || undefined,
      brand: values.brand.trim() || undefined,
      tags: values.tags.trim() || undefined,
      hsnCode: values.type === "PRODUCT" ? values.hsnCode.trim() || undefined : undefined,
      sacCode: values.type === "SERVICE" ? values.sacCode.trim() || undefined : undefined,
      taxRate: Number(values.taxRate) || 0,
      isPriceInclusiveTax: values.isPriceInclusiveTax,
      salesPrice: Number(values.salesPrice) || 0,
      purchasePrice: values.purchasePrice ? Number(values.purchasePrice) : undefined,
      discountType: values.discountType || undefined,
      discountValue: values.discountValue ? Number(values.discountValue) : undefined,
      unit: values.unit.trim() || (values.type === "SERVICE" ? "hrs" : "pcs"),
      trackInventory: values.type === "PRODUCT" ? values.trackInventory : false,
      openingStock: values.type === "PRODUCT" ? Number(values.openingStock) || 0 : 0,
      reorderLevel: values.type === "PRODUCT" ? Number(values.reorderLevel) || 0 : 0,
      allowBackorder: values.type === "PRODUCT" ? values.allowBackorder : false,
      description: values.description.trim() || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width="w-full max-w-[480px]"
      title={isEdit ? `Edit ${typeLabel}` : `Add ${typeLabel}`}
      description="Catalogue items you can invoice. Products track stock, services are billed by unit."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="item-form" loading={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : `Create ${typeLabel}`}
          </Button>
        </>
      }
    >
      <form id="item-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        {serverError && (
          <div className="rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        {/* Classification — hidden when the page fixes the type */}
        {!fixedType && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">
              Item classification <span className="text-danger">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "PRODUCT", label: "Product", hint: "Physical goods with stock", icon: Boxes },
                { value: "SERVICE", label: "Service", hint: "Billable hours or units", icon: Wrench },
              ].map((option) => {
                const Icon = option.icon;
                const selected = values.type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changeType(option.value)}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      selected
                        ? "border-primary-600 bg-primary-50 ring-1 ring-primary-600"
                        : "border-line hover:border-line-strong hover:bg-primary-50"
                    )}
                  >
                    <Icon
                      className={cn("mt-0.5 h-4 w-4 shrink-0", selected ? "text-primary-600" : "text-muted")}
                      aria-hidden="true"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">{option.label}</span>
                      <span className="block text-xs text-muted">{option.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* Basics */}
        <section className="space-y-4 border-t border-line pt-5">
          <h3 className="text-sm font-semibold text-ink">Details</h3>
          <div className="space-y-4">
            <Input
              label="Item name"
              required
              className={CONTROL}
              value={values.name}
              onChange={(e) => setField("name", e.target.value)}
              error={errors.name}
              placeholder="e.g. Solid Wood Dining Chair"
            />
            <Input
              label={isService ? "Service code" : "SKU / item code"}
              className={CONTROL}
              value={values.sku}
              onChange={(e) => setField("sku", e.target.value)}
              placeholder="e.g. CHAIR-OAK-01"
            />
            <Input
              label="Unit of measurement"
              required
              className={CONTROL}
              value={values.unit}
              onChange={(e) => setField("unit", e.target.value)}
              error={errors.unit}
              placeholder="pcs, kg, box, hrs…"
            />
            <Input
              label="Category"
              className={CONTROL}
              value={values.category}
              onChange={(e) => setField("category", e.target.value)}
              placeholder="e.g. Furniture"
            />
            <Input
              label="Sub-category"
              className={CONTROL}
              value={values.subCategory}
              onChange={(e) => setField("subCategory", e.target.value)}
              placeholder="e.g. Seating"
            />
            <Input
              label="Brand / manufacturer"
              className={CONTROL}
              value={values.brand}
              onChange={(e) => setField("brand", e.target.value)}
            />
            <Input
              label={isService ? "SAC code" : "HSN code"}
              className={CONTROL}
              value={isService ? values.sacCode : values.hsnCode}
              onChange={(e) => setField(isService ? "sacCode" : "hsnCode", e.target.value)}
              placeholder={isService ? "e.g. 998311" : "e.g. 9401"}
            />
            <Input
              label="Barcode"
              className={CONTROL}
              value={values.barcode}
              onChange={(e) => setField("barcode", e.target.value)}
            />
            <Input
              label="Tags"
              className={CONTROL}
              value={values.tags}
              onChange={(e) => setField("tags", e.target.value)}
              placeholder="Comma separated"
            />
          </div>
        </section>

        {/* Pricing & GST */}
        <section className="space-y-4 border-t border-line pt-5">
          <h3 className="text-sm font-semibold text-ink">Pricing &amp; GST</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Selling price"
              type="number"
              step="0.01"
              required
              prefix="₹"
              className={CONTROL}
              value={values.salesPrice}
              onChange={(e) => setField("salesPrice", e.target.value)}
              error={errors.salesPrice}
              placeholder="0.00"
            />
            {!isService && (
              <Input
                label="Purchase / cost price"
                type="number"
                step="0.01"
                prefix="₹"
                className={CONTROL}
                value={values.purchasePrice}
                onChange={(e) => setField("purchasePrice", e.target.value)}
                error={errors.purchasePrice}
                placeholder="Optional"
              />
            )}
            <Select
              label="GST rate"
              className={CONTROL}
              value={values.taxRate}
              onChange={(e) => setField("taxRate", e.target.value)}
              options={TAX_RATES.map((rate) => ({
                value: rate,
                label: rate === 0 ? "0% (exempt)" : `${rate}% GST`,
              }))}
            />
            <div className={!isService ? "" : "sm:col-span-2"}>
              <Select
                label="Default discount"
                className={CONTROL}
                value={values.discountType}
                onChange={(e) => setField("discountType", e.target.value)}
                placeholder="No discount"
                options={DISCOUNT_TYPES}
              />
            </div>
            <Input
              label="Discount value"
              type="number"
              step="0.01"
              prefix={values.discountType === "FIXED" ? "₹" : "%"}
              className={CONTROL}
              value={values.discountValue}
              onChange={(e) => setField("discountValue", e.target.value)}
              disabled={!values.discountType}
            />
          </div>

          <Toggle
            checked={values.isPriceInclusiveTax}
            onChange={(checked) => setField("isPriceInclusiveTax", checked)}
            label="Selling price includes GST"
            hint="Tax will be treated as already included in the price"
          />
        </section>

        {/* Inventory — products only */}
        {!isService && (
          <section className="space-y-4 border-t border-line pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Inventory</h3>
              <Toggle
                checked={values.trackInventory}
                onChange={(checked) => setField("trackInventory", checked)}
                label="Track stock"
              />
            </div>

            {values.trackInventory && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Opening stock"
                  type="number"
                  className={CONTROL}
                  value={values.openingStock}
                  onChange={(e) => setField("openingStock", e.target.value)}
                />
                <Input
                  label="Reorder level"
                  type="number"
                  className={CONTROL}
                  value={values.reorderLevel}
                  onChange={(e) => setField("reorderLevel", e.target.value)}
                  hint="Flags the item as low stock at or below this quantity"
                />
                <Toggle
                  checked={values.allowBackorder}
                  onChange={(checked) => setField("allowBackorder", checked)}
                  label="Allow backorders"
                  hint="Permit invoicing beyond available stock"
                />
              </div>
            )}
          </section>
        )}

        <Textarea
          label="Description / billing notes"
          rows={3}
          className={CONTROL}
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Specs, terms, or anything that should appear on the invoice"
        />
      </form>
    </Modal>
  );
}
