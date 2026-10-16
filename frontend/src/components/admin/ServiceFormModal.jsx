import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Modal, Select, Textarea } from "../ui";
import { TAX_MODE_OPTIONS, SERVICE_STATUS_OPTIONS } from "../../lib/serviceConstants";

/**
 * Add / edit form for the new Services logic.
 *
 * Only the fields the backend accepts for a service are collected here — name,
 * service code, selling price with a tax mode, unit, category, the optional
 * description, status and tax rate. Every legacy item field (stock, quantity,
 * purchase price, discount, SKU, barcode, HSN/SAC, brand, tags, sub-category)
 * is intentionally absent, so a service can never silently fall back to them.
 *
 * Unit and Category are dropdowns fed by the Unit & Category page's own option
 * endpoints, exactly like the product form, so the two pages can never drift
 * apart.
 */

const CONTROL = "h-10";

const EMPTY_SERVICE = {
  name: "",
  serviceCode: "",
  unitId: "",
  categoryId: "",
  sellingPrice: "",
  sellingPriceTaxMode: "EXCLUSIVE",
  taxRate: "",
  description: "",
  status: "ACTIVE",
};

/** Maps a stored service row onto the form's field names and string values. */
function toFormValues(service) {
  return {
    name: service.name || "",
    serviceCode: service.serviceCode || "",
    // An older service may have no unit/category yet: the select then shows its
    // placeholder and the admin picks one instead of the form refusing to open.
    unitId: service.unitRef?.id || "",
    categoryId: service.categoryRef?.id || "",
    sellingPrice:
      service.sellingPrice !== null && service.sellingPrice !== undefined
        ? String(service.sellingPrice)
        : "",
    sellingPriceTaxMode: service.sellingPriceTaxMode || "NONE",
    // The API reports `taxRate` as null when the price is not taxed.
    taxRate: service.taxRate !== null && service.taxRate !== undefined ? String(service.taxRate) : "",
    description: service.description || "",
    status: service.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

/** The tax rate only applies when the selling price is taxed. */
function isTaxRateVisible(values) {
  return values.sellingPriceTaxMode !== "NONE";
}

/** Client-side mirror of the backend rules, so obvious mistakes never travel. */
function validate(values, { taxRateVisible }) {
  const errors = {};
  const numberOrNull = (raw) => (raw === "" ? null : Number(raw));

  if (!values.name.trim()) errors.name = "Name is required.";
  if (!values.serviceCode.trim()) errors.serviceCode = "Service code is required.";
  if (!values.unitId) errors.unitId = "Select a unit.";
  if (!values.categoryId) errors.categoryId = "Select a category.";

  const sellingPrice = numberOrNull(values.sellingPrice);
  if (sellingPrice === null || Number.isNaN(sellingPrice)) {
    errors.sellingPrice = "Enter a selling price.";
  } else if (sellingPrice < 0) {
    errors.sellingPrice = "Price cannot be negative.";
  }

  if (taxRateVisible) {
    const taxRate = numberOrNull(values.taxRate);
    if (taxRate === null || Number.isNaN(taxRate)) {
      errors.taxRate = "Tax rate is required when the price is Tax included or Tax excluded.";
    } else if (taxRate < 0 || taxRate > 100) {
      errors.taxRate = "Tax rate must be between 0 and 100.";
    }
  }

  return errors;
}

/** Builds the create/update payload: only the service fields, blanks omitted. */
function toPayload(values) {
  const payload = {
    name: values.name.trim(),
    serviceCode: values.serviceCode.trim(),
    unitId: values.unitId,
    categoryId: values.categoryId,
    sellingPrice: Number(values.sellingPrice),
    sellingPriceTaxMode: values.sellingPriceTaxMode,
    status: values.status,
  };

  if (isTaxRateVisible(values)) payload.taxRate = Number(values.taxRate);
  if (values.description.trim()) payload.description = values.description.trim();

  return payload;
}

export default function ServiceFormModal({
  isOpen,
  onClose,
  onSubmit,
  service,
  units,
  categories,
  saving = false,
  serverError = "",
}) {
  const isEdit = Boolean(service);
  const [values, setValues] = useState(() => (isEdit ? toFormValues(service) : { ...EMPTY_SERVICE }));
  const [errors, setErrors] = useState({});

  // The tax rate only applies to a service whose price is taxed.
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

    await onSubmit(toPayload(values));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width="w-full max-w-[560px]"
      title={isEdit ? "Edit service" : "Add service"}
      description="Services are billed by unit and category, with no stock levels."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="service-form" loading={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create service"}
          </Button>
        </>
      }
    >
      <form id="service-form" onSubmit={handleSubmit} noValidate className="space-y-6">
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
            placeholder="e.g. Website Development"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Service code"
              required
              className={CONTROL}
              value={values.serviceCode}
              onChange={(e) => setField("serviceCode", e.target.value)}
              error={errors.serviceCode}
              placeholder="e.g. SRV-WEB-01"
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
              label="Tax mode"
              required
              className={CONTROL}
              value={values.sellingPriceTaxMode}
              onChange={(e) => setField("sellingPriceTaxMode", e.target.value)}
              options={TAX_MODE_OPTIONS}
            />
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
              hint="Applied to the selling price above."
            />
          )}

          <p className="text-xs text-muted">
            Services are sold without stock levels, purchase prices or discounts.
          </p>
        </section>

        {/* Availability */}
        <section className="space-y-4 border-t border-primary-100 pt-5">
          <h3 className="text-sm font-semibold text-ink">Availability</h3>

          <Select
            label="Status"
            className={CONTROL}
            value={values.status}
            onChange={(e) => setField("status", e.target.value)}
            options={SERVICE_STATUS_OPTIONS}
            hint="Not available services stay hidden from invoicing."
          />

          <Textarea
            label="Description"
            rows={3}
            className={CONTROL}
            value={values.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Scope, terms, or anything that should appear on the invoice"
          />
        </section>
      </form>
    </Modal>
  );
}
