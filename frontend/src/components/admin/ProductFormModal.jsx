import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Modal, Select, Textarea } from "../ui";

/**
 * Add / edit form for the new Products logic.
 *
 * Only the product fields the backend accepts are collected here — the legacy
 * item fields (SKU, barcode, sub-category, tags, SAC code, opening stock,
 * reorder level, backorder toggle) are intentionally absent, so a product can
 * never silently fall back to them. Services keep using the shared ItemFormModal.
 *
 * Unit and Category are dropdowns fed by the Unit & Category page's own option
 * endpoints, so the two pages can never drift apart.
 */

const CONTROL = "h-10";

const TAX_MODES = [
  { value: "INCLUSIVE", label: "Tax included" },
  { value: "EXCLUSIVE", label: "Tax excluded" },
  { value: "NONE", label: "Without tax" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Available" },
  { value: "INACTIVE", label: "Not available" },
];

const EMPTY_PRODUCT = {
  name: "",
  unitId: "",
  productCode: "",
  categoryId: "",
  sellingPrice: "",
  sellingPriceTaxMode: "EXCLUSIVE",
  hsnSacCode: "",
  purchasePrice: "",
  purchasePriceTaxMode: "",
  taxRate: "",
  quantity: "0",
  discountPercent: "",
  brand: "",
  description: "",
  status: "ACTIVE",
};

/** Maps a stored product row onto the form's field names and string values. */
function toFormValues(product) {
  return {
    name: product.name || "",
    unitId: product.unitRef?.id || "",
    productCode: product.productCode || "",
    categoryId: product.categoryRef?.id || "",
    sellingPrice:
      product.sellingPrice !== null && product.sellingPrice !== undefined
        ? String(product.sellingPrice)
        : "",
    sellingPriceTaxMode: product.sellingPriceTaxMode || "NONE",
    hsnSacCode: product.hsnSacCode || "",
    purchasePrice:
      product.purchasePrice !== null && product.purchasePrice !== undefined
        ? String(product.purchasePrice)
        : "",
    purchasePriceTaxMode: product.purchasePriceTaxMode || "",
    taxRate: product.taxRate !== null && product.taxRate !== undefined ? String(product.taxRate) : "",
    quantity: product.quantity !== null && product.quantity !== undefined ? String(product.quantity) : "0",
    discountPercent:
      product.discountPercent !== null && product.discountPercent !== undefined
        ? String(product.discountPercent)
        : "",
    brand: product.brand || "",
    description: product.description || "",
    status: product.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

/** Whether the tax rate field applies to these values at all. */
function isTaxRateVisible(values) {
  const sellingTaxed = values.sellingPriceTaxMode !== "NONE";
  const purchaseTaxed =
    values.purchasePrice !== "" && values.purchasePriceTaxMode && values.purchasePriceTaxMode !== "NONE";
  return sellingTaxed || purchaseTaxed;
}

/** Client-side mirror of the backend rules, so obvious mistakes never travel. */
function validate(values, { taxRateVisible }) {
  const errors = {};
  const numberOrNull = (raw) => (raw === "" ? null : Number(raw));

  if (!values.name.trim()) errors.name = "Name is required.";
  if (!values.unitId) errors.unitId = "Select a unit.";
  if (!values.productCode.trim()) errors.productCode = "Product code is required.";
  if (!values.categoryId) errors.categoryId = "Select a category.";

  const sellingPrice = numberOrNull(values.sellingPrice);
  if (sellingPrice === null || Number.isNaN(sellingPrice)) {
    errors.sellingPrice = "Enter a selling price.";
  } else if (sellingPrice < 0) {
    errors.sellingPrice = "Price cannot be negative.";
  }

  // A purchase price is optional, but once entered its tax mode becomes
  // required — exactly the backend's rule.
  const purchasePrice = numberOrNull(values.purchasePrice);
  if (purchasePrice !== null) {
    if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
      errors.purchasePrice = "Price cannot be negative.";
    } else if (!values.purchasePriceTaxMode) {
      errors.purchasePriceTaxMode = "Select a tax mode for the purchase price.";
    }
  }

  if (taxRateVisible) {
    const taxRate = numberOrNull(values.taxRate);
    if (taxRate === null || Number.isNaN(taxRate)) {
      errors.taxRate = "Tax rate is required when a price mode is Tax included or Tax excluded.";
    } else if (taxRate < 0 || taxRate > 100) {
      errors.taxRate = "Tax rate must be between 0 and 100.";
    }
  }

  const quantity = numberOrNull(values.quantity);
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) {
    errors.quantity = "Quantity must be a whole number of 0 or more.";
  }

  const discountPercent = numberOrNull(values.discountPercent);
  if (discountPercent !== null && (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100)) {
    errors.discountPercent = "Discount must be between 0 and 100%.";
  }

  return errors;
}

/** Builds the create/update payload from the form values, omitting blanks. */
function toPayload(values, { taxRateVisible }) {
  const payload = {
    name: values.name.trim(),
    productCode: values.productCode.trim(),
    unitId: values.unitId,
    categoryId: values.categoryId,
    sellingPrice: Number(values.sellingPrice),
    sellingPriceTaxMode: values.sellingPriceTaxMode,
    quantity: values.quantity === "" ? 0 : Number(values.quantity),
    status: values.status,
  };

  if (values.hsnSacCode.trim()) payload.hsnSacCode = values.hsnSacCode.trim();
  if (values.purchasePrice !== "") {
    payload.purchasePrice = Number(values.purchasePrice);
    payload.purchasePriceTaxMode = values.purchasePriceTaxMode;
  }
  if (taxRateVisible) payload.taxRate = Number(values.taxRate);
  if (values.discountPercent !== "") payload.discountPercent = Number(values.discountPercent);
  if (values.brand.trim()) payload.brand = values.brand.trim();
  if (values.description.trim()) payload.description = values.description.trim();

  return payload;
}

export default function ProductFormModal({
  isOpen,
  onClose,
  onSubmit,
  product,
  units,
  categories,
  saving = false,
  serverError = "",
}) {
  const isEdit = Boolean(product);
  const [values, setValues] = useState(() => (isEdit ? toFormValues(product) : { ...EMPTY_PRODUCT }));
  const [errors, setErrors] = useState({});

  // The tax rate only applies to a product whose price is taxed on either side.
  const taxRateVisible = isTaxRateVisible(values);

  const noUnits = units.length === 0;
  const noCategories = categories.length === 0;

  const setField = (field, value) => {
    setValues((previous) => {
      const next = { ...previous, [field]: value };
      // A tax rate that no longer applies is cleared immediately, so re-showing
      // the field never resurrects a value the admin has moved away from.
      if (!isTaxRateVisible(next)) next.taxRate = "";
      return next;
    });
    setErrors((previous) => ({ ...previous, [field]: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const found = validate(values, { taxRateVisible });
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    await onSubmit(toPayload(values, { taxRateVisible }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width="w-full max-w-[560px]"
      title={isEdit ? "Edit product" : "Add product"}
      description="Products track stock and GST tax codes. Services are managed on their own page."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        {serverError && (
          <div className="rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        {(noUnits || noCategories) && (
          <div className="rounded-control border border-warning-line bg-warning-soft px-4 py-3 text-sm text-amber-800">
            {noUnits && noCategories
              ? "No units or categories have been saved yet. "
              : noUnits
                ? "No units have been saved yet. "
                : "No categories have been saved yet. "}
            <Link to="/admin/unit-category" className="font-medium underline">
              Add them on the Unit &amp; Category page
            </Link>
            .
          </div>
        )}

        {/* Details */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-ink">Details</h3>

          <Input
            label="Name"
            required
            className={CONTROL}
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            error={errors.name}
            placeholder="e.g. Solid Wood Dining Chair"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Product code"
              required
              className={CONTROL}
              value={values.productCode}
              onChange={(e) => setField("productCode", e.target.value)}
              error={errors.productCode}
              placeholder="e.g. CHAIR-OAK-01"
              hint="Reusable when the selling price differs"
            />
            <Select
              label="Unit"
              required
              className={CONTROL}
              value={values.unitId}
              onChange={(e) => setField("unitId", e.target.value)}
              error={errors.unitId}
              placeholder={noUnits ? "No units saved yet" : "Select a unit"}
              disabled={noUnits}
              options={units.map((unit) => ({
                value: unit.id,
                label: unit.shortName ? `${unit.fullName} (${unit.shortName})` : unit.fullName,
              }))}
            />
          </div>

          <Select
            label="Category"
            required
            className={CONTROL}
            value={values.categoryId}
            onChange={(e) => setField("categoryId", e.target.value)}
            error={errors.categoryId}
            placeholder={noCategories ? "No categories saved yet" : "Select a category"}
            disabled={noCategories}
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="HSN / SAC code"
              className={CONTROL}
              value={values.hsnSacCode}
              onChange={(e) => setField("hsnSacCode", e.target.value)}
              placeholder="e.g. 9401"
            />
            <Input
              label="Brand / manufacturer"
              className={CONTROL}
              value={values.brand}
              onChange={(e) => setField("brand", e.target.value)}
            />
          </div>
        </section>

        {/* Pricing & GST */}
        <section className="space-y-4 border-t border-primary-100 pt-5">
          <h3 className="text-sm font-semibold text-ink">Pricing &amp; GST</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Selling price"
              type="number"
              step="0.01"
              min="0"
              required
              prefix="₹"
              className={CONTROL}
              value={values.sellingPrice}
              onChange={(e) => setField("sellingPrice", e.target.value)}
              error={errors.sellingPrice}
              placeholder="0.00"
            />
            <Select
              label="Selling price tax mode"
              required
              className={CONTROL}
              value={values.sellingPriceTaxMode}
              onChange={(e) => setField("sellingPriceTaxMode", e.target.value)}
              options={TAX_MODES}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Purchase / cost price"
              type="number"
              step="0.01"
              min="0"
              prefix="₹"
              className={CONTROL}
              value={values.purchasePrice}
              onChange={(e) => setField("purchasePrice", e.target.value)}
              error={errors.purchasePrice}
              placeholder="Optional"
            />
            {values.purchasePrice !== "" && (
              <Select
                label="Purchase price tax mode"
                required
                className={CONTROL}
                value={values.purchasePriceTaxMode}
                onChange={(e) => setField("purchasePriceTaxMode", e.target.value)}
                error={errors.purchasePriceTaxMode}
                placeholder="Select a tax mode"
                options={TAX_MODES}
              />
            )}
          </div>

          {taxRateVisible && (
            <Input
              label="Tax rate (%)"
              type="number"
              step="0.01"
              min="0"
              max="100"
              required
              className={CONTROL}
              value={values.taxRate}
              onChange={(e) => setField("taxRate", e.target.value)}
              error={errors.taxRate}
              placeholder="e.g. 18"
              hint="Used to split the taxed prices above into value and tax."
            />
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Quantity"
              type="number"
              step="1"
              min="0"
              className={CONTROL}
              value={values.quantity}
              onChange={(e) => setField("quantity", e.target.value)}
              error={errors.quantity}
              hint="Stock on hand; 0 means Not available"
            />
            <Input
              label="Discount (%)"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className={CONTROL}
              value={values.discountPercent}
              onChange={(e) => setField("discountPercent", e.target.value)}
              error={errors.discountPercent}
              placeholder="Optional"
            />
          </div>
        </section>

        {/* Status & notes */}
        <section className="space-y-4 border-t border-primary-100 pt-5">
          <h3 className="text-sm font-semibold text-ink">Availability</h3>

          <Select
            label="Status"
            className={CONTROL}
            value={values.status}
            onChange={(e) => setField("status", e.target.value)}
            options={STATUS_OPTIONS}
            hint="A product with no stock cannot be marked Available."
          />

          <Textarea
            label="Description"
            rows={3}
            className={CONTROL}
            value={values.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Specs, terms, or anything that should appear on the invoice"
          />
        </section>
      </form>
    </Modal>
  );
}
