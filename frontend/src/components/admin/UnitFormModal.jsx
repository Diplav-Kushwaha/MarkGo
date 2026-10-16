import { useEffect, useState } from "react";
import { Button, Input, Modal, Select } from "../ui";
import { getUnitOptions } from "../../api/unitAdminApi";

const EMPTY_UNIT = {
  fullName: "",
  shortName: "",
  isPackage: false,
  quantity: "",
  baseUnitId: "",
};

/**
 * Create / edit a Unit. When "This unit contains other units" is checked,
 * Quantity + Base Unit (simple units only) appear and a live preview reads
 * "1 Box = 12 Pcs". Built-in (system) units are rendered read-only.
 *
 * Mirrors ItemFormModal: values are seeded from props in the useState
 * initializer (and the parent remounts via `key={editing?.id}`), so there is no
 * set-state-inside-effect for value initialisation.
 */
export default function UnitFormModal({ isOpen, onClose, onSubmit, unit, saving, serverError, serverFieldErrors = {}, existingItem, onUseExisting }) {
  const isEdit = Boolean(unit);
  const readOnly = unit?.isBuiltIn;

  // Options for the base-unit dropdown; fetched once per open. SetStates only
  // happen inside async callbacks, never at the effect top level.
  const [simpleUnits, setSimpleUnits] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [values, setValues] = useState(() =>
    isEdit
      ? {
          fullName: unit.fullName || "",
          shortName: unit.shortName || "",
          isPackage: unit.isPackage || false,
          quantity: unit.quantity != null ? String(unit.quantity) : "",
          baseUnitId: unit.baseUnitId || (unit.baseUnit ? unit.baseUnit.id : ""),
        }
      : EMPTY_UNIT
  );
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    getUnitOptions()
      .then((res) => {
        if (cancelled) return;
        const all = res?.success ? res.data || [] : [];
        setSimpleUnits(all.filter((u) => !u.isPackage));
      })
      .catch(() => {
        if (!cancelled) setSimpleUnits([]);
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const setField = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const baseUnitOptions = simpleUnits.map((u) => ({
    value: u.id,
    label: `${u.fullName} (${u.shortName})`,
  }));

  const baseUnitShortName = simpleUnits.find((u) => u.id === values.baseUnitId)?.shortName;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) return;

    const newErrors = {};
    if (!values.fullName.trim()) newErrors.fullName = "Unit full name is required.";
    if (!values.shortName.trim()) newErrors.shortName = "Unit short name is required.";
    if (values.isPackage) {
      if (!values.quantity || Number(values.quantity) <= 0) newErrors.quantity = "Quantity must be greater than 0.";
      if (!values.baseUnitId) newErrors.baseUnitId = "Base unit is required.";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length) return;

    const payload = {
      fullName: values.fullName.trim(),
      shortName: values.shortName.trim(),
      isPackage: values.isPackage,
    };
    // Only send the package fields for package units: the API treats
    // them as optional, and explicit nulls fail optional validation.
    if (values.isPackage) {
      payload.quantity = Number(values.quantity);
      payload.baseUnitId = values.baseUnitId;
    }

    onSubmit(payload);
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" form="unit-form" loading={saving} disabled={readOnly}>
        {saving ? "Saving…" : isEdit ? "Save changes" : "Add unit"}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={readOnly ? undefined : onClose}
      title={isEdit ? (readOnly ? `View ${unit.fullName}` : `Edit ${unit.fullName}`) : "Add unit"}
      size="md"
      footer={footer}
    >
      <form id="unit-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && (
          <div className={`rounded-control border px-4 py-3 text-sm ${existingItem ? "border-info-line bg-info-soft text-blue-700" : "border-danger-line bg-danger-soft text-red-700"}`}>
            {serverError}
            {existingItem && <div className="mt-2"><Button type="button" variant="secondary" onClick={onUseExisting}>Use existing</Button></div>}
          </div>
        )}

        <Input
          label="Unit Full Name"
          placeholder="e.g. Kilogram"
          required
          disabled={readOnly}
          error={errors.fullName || serverFieldErrors.fullName}
          value={values.fullName}
          onChange={(e) => setField("fullName", e.target.value)}
        />

        <Input
          label="Unit Short Name"
          placeholder="e.g. kg"
          required
          disabled={readOnly}
          error={errors.shortName || serverFieldErrors.shortName}
          value={values.shortName}
          onChange={(e) => setField("shortName", e.target.value)}
        />

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-line text-primary-600 focus:ring-primary-600"
            disabled={readOnly}
            checked={values.isPackage}
            onChange={(e) => {
              const checked = e.target.checked;
              setField("isPackage", checked);
              if (!checked) {
                setField("quantity", "");
                setField("baseUnitId", "");
                setErrors((prev) => ({ ...prev, quantity: undefined, baseUnitId: undefined }));
              }
            }}
          />
          <span className="block text-sm text-ink">This unit contains other units (e.g. Box, Packet)</span>
        </label>

        {values.isPackage && (
          <div className="space-y-4 pl-1">
            <Input
              label="Quantity"
              placeholder="e.g. 12"
              type="number"
              min="0.0001"
              step="0.01"
              required
              disabled={readOnly}
              error={errors.quantity || serverFieldErrors.quantity}
              value={values.quantity}
              onChange={(e) => setField("quantity", e.target.value)}
            />

            <Select
              label="Base Unit"
              required
              disabled={readOnly || optionsLoading}
              placeholder={optionsLoading ? "Loading units…" : "Select a simple unit"}
              value={values.baseUnitId}
              error={errors.baseUnitId || serverFieldErrors.baseUnitId}
              onChange={(e) => setField("baseUnitId", e.target.value)}
              options={baseUnitOptions}
            />

            {values.fullName && values.shortName && Number(values.quantity) > 0 && baseUnitShortName && (
              <p className="text-xs text-muted">
                Preview: 1 {values.fullName} ({values.shortName}) = {Number(values.quantity)} {baseUnitShortName}
              </p>
            )}
          </div>
        )}

        {!readOnly && (
          <p className="text-xs text-muted">Built-in units are shared across all companies and are read-only.</p>
        )}
      </form>
    </Modal>
  );
}
