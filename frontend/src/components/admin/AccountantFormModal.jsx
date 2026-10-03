import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Input, Modal } from "../ui";

// Mirrors backend/src/validators/accountantSchemas.js
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_ACCOUNTANT = {
  name: "",
  email: "",
  phoneNumber: "",
  licenseNumber: "",
  experience: "",
};

function validate(values) {
  const errors = {};

  if (!values.name.trim()) errors.name = "Full name is required.";
  else if (values.name.trim().length < 2) errors.name = "Must be at least 2 characters.";
  else if (values.name.trim().length > 120) errors.name = "Must be 120 characters or fewer.";

  if (!values.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address.";

  if (values.phoneNumber.trim() && !PHONE_PATTERN.test(values.phoneNumber.trim())) {
    errors.phoneNumber = "Enter a valid phone number (8-15 digits).";
  }

  if (values.licenseNumber.trim().length > 50) {
    errors.licenseNumber = "Must be 50 characters or fewer.";
  }
  if (values.experience.trim().length > 50) {
    errors.experience = "Must be 50 characters or fewer.";
  }

  return errors;
}

export default function AccountantFormModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  accountant,
  saving = false,
  deleting = false,
  serverError = "",
}) {
  const isEdit = Boolean(accountant);
  // Mounted only while the dialog is open, so initial values come from props.
  const [values, setValues] = useState(() =>
    isEdit
      ? {
          name: accountant.name || "",
          email: accountant.email || "",
          phoneNumber: accountant.phoneNumber || "",
          licenseNumber: accountant.licenseNumber || "",
          experience: accountant.experience || "",
        }
      : EMPTY_ACCOUNTANT
  );
  const [errors, setErrors] = useState({});

  const setField = (field, value) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const found = validate(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    // Payload shape is unchanged from the previous implementation.
    await onSubmit({
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phoneNumber: values.phoneNumber.trim() || undefined,
      licenseNumber: values.licenseNumber.trim() || undefined,
      experience: values.experience.trim() || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={isEdit ? "Edit accountant" : "Add accountant"}
      description={
        isEdit
          ? "Update this accountant's contact and registration details."
          : "Create an accountant account. You can send them a setup link straight after."
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {serverError && (
          <div className="rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            required
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            error={errors.name}
            placeholder="e.g. Priya Nair"
            containerClassName="sm:col-span-2"
          />

          <Input
            label="Email address"
            type="email"
            required
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            error={errors.email}
            placeholder="accountant@example.com"
          />

          <Input
            label="Phone number"
            value={values.phoneNumber}
            onChange={(e) => setField("phoneNumber", e.target.value)}
            error={errors.phoneNumber}
            placeholder="e.g. 9876543210"
          />

          <Input
            label="License / registration number"
            value={values.licenseNumber}
            onChange={(e) => setField("licenseNumber", e.target.value)}
            error={errors.licenseNumber}
            placeholder="e.g. ICAI-49210"
          />

          <Input
            label="Experience / title"
            value={values.experience}
            onChange={(e) => setField("experience", e.target.value)}
            error={errors.experience}
            placeholder="e.g. Senior Tax Auditor"
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          {isEdit && onDelete ? (
            <Button
              type="button"
              variant="danger-soft"
              onClick={onDelete}
              loading={deleting}
              disabled={saving}
            >
              {!deleting && <Trash2 className="h-4 w-4" aria-hidden="true" />}
              Delete accountant
            </Button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={deleting}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add accountant"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
