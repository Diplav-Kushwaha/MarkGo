import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Input, Modal } from "../ui";

// Mirrors backend/src/validators/staffSchemas.js
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_TEAM_MEMBER = {
  name: "",
  email: "",
  phoneNumber: "",
  designation: "",
  department: "",
};

function validate(values) {
  const errors = {};

  if (!values.name.trim()) errors.name = "Full name is required.";
  else if (values.name.trim().length < 2) errors.name = "Must be at least 2 characters.";

  if (!values.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address.";

  if (values.phoneNumber.trim() && !PHONE_PATTERN.test(values.phoneNumber.trim())) {
    errors.phoneNumber = "Enter a valid phone number (8-15 digits).";
  }

  return errors;
}

export default function TeamMemberFormModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  member,
  saving = false,
  deleting = false,
  serverError = "",
}) {
  const isEdit = Boolean(member);
  // The page mounts this only while the dialog is open, so the initial values
  // can be read straight from props instead of being synced in an effect.
  const [values, setValues] = useState(() =>
    isEdit
      ? {
          name: member.name || "",
          email: member.email || "",
          phoneNumber: member.phoneNumber || "",
          designation: member.designation || "",
          department: member.department || "",
        }
      : EMPTY_TEAM_MEMBER
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
      designation: values.designation.trim() || undefined,
      department: values.department.trim() || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={isEdit ? "Edit team member" : "Add team member"}
      description={
        isEdit
          ? "Update this member's contact details and role."
          : "Create a team account. You can send them a setup link straight after."
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
            placeholder="e.g. Rahul Sharma"
            containerClassName="sm:col-span-2"
          />

          <Input
            label="Email address"
            type="email"
            required
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            error={errors.email}
            placeholder="name@company.com"
          />

          <Input
            label="Phone number"
            value={values.phoneNumber}
            onChange={(e) => setField("phoneNumber", e.target.value)}
            error={errors.phoneNumber}
            placeholder="e.g. 9876543210"
          />

          <Input
            label="Designation"
            value={values.designation}
            onChange={(e) => setField("designation", e.target.value)}
            placeholder="e.g. Inventory Manager"
          />

          <Input
            label="Department"
            value={values.department}
            onChange={(e) => setField("department", e.target.value)}
            placeholder="e.g. Warehouse / Logistics"
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          {isEdit && onDelete ? (
            <Button type="button" variant="danger-soft" onClick={onDelete} loading={deleting} disabled={saving}>
              {!deleting && <Trash2 className="h-4 w-4" aria-hidden="true" />}
              Delete member
            </Button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={deleting}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add member"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
