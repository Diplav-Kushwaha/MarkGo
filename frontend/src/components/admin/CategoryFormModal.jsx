import { useState } from "react";
import { Button, Input, Modal, Select } from "../ui";

const TYPE_OPTIONS = [
  { value: "PRODUCT", label: "Product" },
  { value: "SERVICE", label: "Service" },
];

/**
 * Create / edit a Category. Built-in (system) categories are read-only; the
 * parent never opens this form for one, but every field is disabled defensively.
 *
 * Values are seeded from props in the useState initializer (the parent remounts
 * via `key={editing?.id}`), mirroring ItemFormModal — no effects needed.
 */
export default function CategoryFormModal({ isOpen, onClose, onSubmit, category, saving, serverError, existingItem, onUseExisting }) {
  const isEdit = Boolean(category);
  const readOnly = category?.isBuiltIn;

  const [values, setValues] = useState(() =>
    isEdit ? { name: category.name || "", type: category.type || "PRODUCT" } : { name: "", type: "PRODUCT" }
  );
  const [errors, setErrors] = useState({});

  const setField = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) return;

    const newErrors = {};
    if (!values.name.trim()) newErrors.name = "Category name is required.";
    if (!values.type) newErrors.type = "Select a category type.";
    setErrors(newErrors);
    if (Object.keys(newErrors).length) return;

    onSubmit({ name: values.name.trim(), type: values.type });
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" form="category-form" loading={saving} disabled={readOnly}>
        {saving ? "Saving…" : isEdit ? "Save changes" : "Add category"}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={readOnly ? undefined : onClose}
      title={isEdit ? (readOnly ? `View ${category?.name}` : `Edit ${category?.name}`) : "Add category"}
      size="md"
      footer={footer}
    >
      <form id="category-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && (
          <div className={`rounded-control border px-4 py-3 text-sm ${existingItem ? "border-info-line bg-info-soft text-blue-700" : "border-danger-line bg-danger-soft text-red-700"}`}>
            {serverError}
            {existingItem && <div className="mt-2"><Button type="button" variant="secondary" onClick={onUseExisting}>Use existing</Button></div>}
          </div>
        )}

        <Input
          label="Category Name"
          placeholder="e.g. Grocery"
          required
          disabled={readOnly}
          error={errors.name}
          value={values.name}
          onChange={(e) => setField("name", e.target.value)}
        />

        <Select
          label="Type"
          required
          disabled={readOnly}
          error={errors.type}
          value={values.type}
          onChange={(e) => setField("type", e.target.value)}
          options={TYPE_OPTIONS}
        />
      </form>
    </Modal>
  );
}
