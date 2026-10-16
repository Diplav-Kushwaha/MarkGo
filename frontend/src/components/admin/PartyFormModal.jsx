import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Input, Modal } from "../ui";
import { isValidPhone, normalizePhone, INVALID_PHONE_MESSAGE } from "../../lib/phone";

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_PARTY = {
  name: "",
  email: "",
  phoneNumber: "",
  taxNumber: "",
  creditLimit: "",
  billingAddress: { line1: "", city: "", state: "", country: "", postalCode: "" },
};

function validate(values) {
  const errors = {};

  if (!values.name.trim()) errors.name = "Name is required.";
  else if (values.name.trim().length < 2) errors.name = "Must be at least 2 characters.";

  if (!values.phoneNumber.trim()) {
    errors.phoneNumber = "Phone number is required.";
  } else if (!isValidPhone(values.phoneNumber)) {
    errors.phoneNumber = INVALID_PHONE_MESSAGE;
  }

  if (values.creditLimit === "" || values.creditLimit === null || values.creditLimit === undefined) {
    errors.creditLimit = "Credit limit is required.";
  } else if (Number.isNaN(Number(values.creditLimit)) || Number(values.creditLimit) < 0) {
    errors.creditLimit = "Credit limit cannot be negative.";
  }

  // Optional fields are only validated when a value is provided.
  if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (values.taxNumber.trim() && !GSTIN_PATTERN.test(values.taxNumber.trim().toUpperCase())) {
    errors.taxNumber = "Enter a valid 15-character GSTIN.";
  }

  return errors;
}

function toFormValues(party) {
  const billing = party?.addresses?.find((address) => address.type === "BILLING") || {};

  return {
    name: party?.name || "",
    email: party?.email || "",
    phoneNumber: party?.phoneNumber || "",
    taxNumber: party?.taxNumber || "",
    creditLimit: party?.creditLimit ? String(party.creditLimit) : "",
    billingAddress: {
      line1: billing.line1 || "",
      city: billing.city || "",
      state: billing.state || "",
      country: billing.country || "",
      postalCode: billing.postalCode || "",
    },
  };
}

export default function PartyFormModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  party,
  mode,
  partyLabel = "Customer",
  nameLabel = "Customer / Business Name",
  addressLabel = "Billing Address",
  saving = false,
  deleting = false,
  serverError = "",
}) {
  // "add" shows only the registration fields; "edit" shows every
  // field so optional details can be filled in later.
  const isEdit = mode ? mode === "edit" : Boolean(party);
  const [values, setValues] = useState(() => (isEdit ? toFormValues(party) : EMPTY_PARTY));
  const [errors, setErrors] = useState({});

  const setField = (field, value) => {
    setValues((previous) => {
      if (field.startsWith("billingAddress.")) {
        const key = field.replace("billingAddress.", "");
        return { ...previous, billingAddress: { ...previous.billingAddress, [key]: value } };
      }
      return { ...previous, [field]: value };
    });
    setErrors((previous) => ({ ...previous, [field]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const found = validate(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    const email = values.email.trim();
    const taxNumber = values.taxNumber.trim();
    const address = values.billingAddress;

    // Blank optional values are sent as null so they are stored
    // as NULL instead of reaching the database as "".
    await onSubmit({
      name: values.name.trim(),
      email: email ? email.toLowerCase() : null,
      phoneNumber: normalizePhone(values.phoneNumber),
      taxNumber: taxNumber ? taxNumber.toUpperCase() : null,
      creditLimit: Number(values.creditLimit),
      billingAddress: {
        line1: address.line1.trim() || null,
        city: address.city.trim() || null,
        state: address.state.trim() || null,
        country: address.country.trim() || null,
        postalCode: address.postalCode.trim() || null,
      },
      sameAsBilling: true,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${partyLabel.toLowerCase()}` : `Add new ${partyLabel.toLowerCase()}`}
      description={
        isEdit
          ? `Update ${partyLabel.toLowerCase()} details and billing address.`
          : `Create a ${partyLabel.toLowerCase()} record. Required: Name, Phone, Credit Limit. You can send a login invite afterwards.`
      }
    >
      <form id="party-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {serverError && (
          <div className="rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={nameLabel}
            required
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            error={errors.name}
            placeholder="e.g. Acme Logistics"
            containerClassName="sm:col-span-2"
          />

          <Input
            label="Phone number"
            required
            value={values.phoneNumber}
            onChange={(e) => setField("phoneNumber", e.target.value.replace(/\D/g, "").slice(0, 10))}
            error={errors.phoneNumber}
            placeholder="e.g. 9876543210"
            hint="Required. 10 digits. Used for login."
          />

          <Input
            label="Credit limit"
            required
            type="number"
            min="0"
            prefix="₹"
            value={values.creditLimit}
            onChange={(e) => setField("creditLimit", e.target.value)}
            error={errors.creditLimit}
            placeholder="e.g. 50000"
            hint="Required"
          />

          {isEdit && (
            <>
              <Input
                label="Email address (optional)"
                type="email"
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
                error={errors.email}
                placeholder="name@example.com"
              />

              <Input
                label="Tax / GST number (optional)"
                value={values.taxNumber}
                onChange={(e) => setField("taxNumber", e.target.value.toUpperCase())}
                error={errors.taxNumber}
                placeholder="Optional"
              />
            </>
          )}
        </div>

        <fieldset className="space-y-4 border-t border-primary-100 pt-5">
          <legend className="text-sm font-medium text-ink">{addressLabel} (optional)</legend>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Address line 1"
              value={values.billingAddress.line1}
              onChange={(e) => setField("billingAddress.line1", e.target.value)}
              error={errors["billingAddress.line1"]}
              placeholder="Street address"
              containerClassName="sm:col-span-2"
            />

            {isEdit && (
              <>
                <Input
                  label="City"
                  value={values.billingAddress.city}
                  onChange={(e) => setField("billingAddress.city", e.target.value)}
                />

                <Input
                  label="State"
                  value={values.billingAddress.state}
                  onChange={(e) => setField("billingAddress.state", e.target.value)}
                />

                <Input
                  label="Country"
                  value={values.billingAddress.country}
                  onChange={(e) => setField("billingAddress.country", e.target.value)}
                />

                <Input
                  label="Postal code"
                  value={values.billingAddress.postalCode}
                  onChange={(e) => setField("billingAddress.postalCode", e.target.value)}
                />
              </>
            )}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-3 border-t border-primary-100 pt-4">
          {isEdit && onDelete ? (
            <Button
              type="button"
              variant="danger-soft"
              onClick={onDelete}
              loading={deleting}
              disabled={saving}
            >
              {!deleting && <Trash2 className="h-4 w-4" aria-hidden="true" />}
              Delete {partyLabel.toLowerCase()}
            </Button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={deleting}>
              {saving ? "Saving…" : isEdit ? "Save changes" : `Save ${partyLabel.toLowerCase()}`}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
