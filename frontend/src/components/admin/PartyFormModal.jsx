import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Input, Modal } from "../ui";

// Mirrors the backend validators (customerSchemas.js / vendorSchemas.js) so the
// user gets feedback before a round trip.
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;
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

  if (!values.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address.";

  if (values.phoneNumber.trim() && !PHONE_PATTERN.test(values.phoneNumber.trim())) {
    errors.phoneNumber = "Enter a valid phone number (8-15 digits).";
  }

  if (values.taxNumber.trim() && !GSTIN_PATTERN.test(values.taxNumber.trim().toUpperCase())) {
    errors.taxNumber = "Enter a valid 15-character GSTIN.";
  }

  if (values.creditLimit !== "" && Number(values.creditLimit) < 0) {
    errors.creditLimit = "Credit limit cannot be negative.";
  }

  if (!values.billingAddress.line1.trim()) {
    errors["billingAddress.line1"] = "Address line 1 is required.";
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
  partyLabel = "Customer",
  nameLabel = "Customer / Business Name",
  addressLabel = "Billing Address",
  saving = false,
  deleting = false,
  serverError = "",
}) {
  const isEdit = Boolean(party);
  // The page mounts this only while the dialog is open, so the initial values
  // can be read straight from props instead of being synced in an effect.
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

    // Payload shape is unchanged from the previous implementation — empty
    // optional fields are sent as undefined so the backend defaults apply.
    const address = values.billingAddress;
    await onSubmit({
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phoneNumber: values.phoneNumber.trim() || undefined,
      taxNumber: values.taxNumber.trim() || undefined,
      creditLimit: values.creditLimit ? Number(values.creditLimit) : undefined,
      billingAddress: {
        line1: address.line1.trim(),
        city: address.city.trim() || undefined,
        state: address.state.trim() || undefined,
        country: address.country.trim() || undefined,
        postalCode: address.postalCode.trim() || undefined,
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
          : `Create a ${partyLabel.toLowerCase()} record. You can send them a login invite afterwards.`
      }
    >
      <form id="party-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {serverError && (
          <div className="rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">
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
            label="Email address"
            type="email"
            required
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            error={errors.email}
            placeholder="name@example.com"
          />

          <Input
            label="Phone number"
            value={values.phoneNumber}
            onChange={(e) => setField("phoneNumber", e.target.value)}
            error={errors.phoneNumber}
            placeholder="e.g. 9876543210"
          />

          <Input
            label="Tax / GST number"
            value={values.taxNumber}
            onChange={(e) => setField("taxNumber", e.target.value.toUpperCase())}
            error={errors.taxNumber}
            placeholder="Optional"
          />

          <Input
            label="Credit limit"
            type="number"
            min="0"
            prefix="₹"
            value={values.creditLimit}
            onChange={(e) => setField("creditLimit", e.target.value)}
            error={errors.creditLimit}
            placeholder="e.g. 50000"
          />
        </div>

        <fieldset className="space-y-4 border-t border-line pt-5">
          <legend className="text-sm font-medium text-ink">{addressLabel}</legend>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Address line 1"
              required
              value={values.billingAddress.line1}
              onChange={(e) => setField("billingAddress.line1", e.target.value)}
              error={errors["billingAddress.line1"]}
              placeholder="Street address"
              containerClassName="sm:col-span-2"
            />

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
          </div>
        </fieldset>

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
