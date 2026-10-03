import { useEffect, useState } from "react";
import { Building2, Check, Copy, Eye, EyeOff, Send } from "lucide-react";
import {
  createSuperAdminCompany,
  deleteSuperAdminPendingCompany,
  getSuperAdminPlans,
} from "../../api/superAdminSubscriptionApi";
import { formatFullCurrency } from "./superadminFormat";
import { planBillingLabel } from "./superadminPlanHelpers";
import { InlineDeleteConfirm } from "./CompanyStatusModals";
import { SAButton, SASelect, SATone } from "./SuperAdminUi";
import { SAInput } from "./SuperAdminUi";
import { Modal } from "../../components/ui";
import { formatDate } from "../../lib/format";

const EMPTY_FORM = {
  companyName: "",
  companyEmail: "",
  companyAddress: "",
  gstNumber: "",
  city: "",
  country: "",
  fullName: "",
  email: "",
  phoneNumber: "",
  password: "",
  planId: "",
  payment: "MANUAL",
  paymentNote: "",
};

/** Mirrors the public registration page's client-side password rules. */
function validatePassword(pw) {
  if (!pw) return "Password is required.";
  if (pw.length < 8) return "Password must be at least 8 characters long.";
  if (!/[a-z]/.test(pw)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Password must include an uppercase letter.";
  if (!/\d/.test(pw)) return "Password must include a digit.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must include a special character.";
  return null;
}

function FieldMessage({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-600">
      {message}
    </p>
  );
}

/**
 * Create a company from the Super Admin console: the same fields the public
 * registration page collects, plus which plan it starts on and how that is paid.
 * The Super Admin's own session is never touched and no token is issued.
 */
export default function AddCompanyModal({ isOpen, onClose, onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [plans, setPlans] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // The parent mounts this only while it is open, so the initial values below are
  // the reset values — no effect needed to clear the form between uses.
  useEffect(() => {
    if (!isOpen) return;
    getSuperAdminPlans()
      .then((res) => {
        if (res?.success) {
          setPlans(Array.isArray(res.data?.plans) ? res.data.plans : []);
        } else {
          setFormError(res?.message || "Could not load the plan list.");
        }
      })
      .catch((err) => {
        setFormError(err.response?.data?.message || "Could not load the plan list.");
      });
  }, [isOpen]);

  const setField = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
    setFormError("");
  };

  const selectedPlan = plans.find((plan) => plan.id === form.planId);
  const planIsFree = selectedPlan?.billingCycle === "FREE";
  const showPayment = Boolean(selectedPlan) && !planIsFree;

  const validate = () => {
    const found = {};
    if (!form.companyName.trim()) found.companyName = "Company name is required.";
    else if (form.companyName.trim().length < 2) {
      found.companyName = "Company name must be at least 2 characters.";
    }
    if (!form.companyEmail.trim()) found.companyEmail = "Company email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.companyEmail.trim())) {
      found.companyEmail = "Enter a valid company email address.";
    }
    if (!form.companyAddress.trim() || form.companyAddress.trim().length < 5) {
      found.companyAddress = "Company address must be at least 5 characters.";
    }
    if (!form.city.trim()) found.city = "City is required.";
    if (!form.country.trim()) found.country = "Country is required.";
    if (!form.fullName.trim()) found.fullName = "Full name is required.";
    if (!form.email.trim()) found.email = "Admin login email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      found.email = "Enter a valid email address.";
    }
    if (!/^\+?[1-9]\d{7,14}$/.test(form.phoneNumber.trim())) {
      found.phoneNumber = "Enter a valid phone number, digits only (with optional country code).";
    }
    const passwordError = validatePassword(form.password);
    if (passwordError) found.password = passwordError;
    if (!form.planId) found.planId = "Select a plan.";

    return found;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        companyName: form.companyName.trim(),
        companyEmail: form.companyEmail.trim().toLowerCase(),
        companyAddress: form.companyAddress.trim(),
        gstNumber: form.gstNumber.trim() ? form.gstNumber.trim().toUpperCase() : "",
        city: form.city.trim(),
        country: form.country.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phoneNumber: form.phoneNumber.trim(),
        password: form.password,
        planId: form.planId,
        payment: showPayment ? form.payment : "MANUAL",
        ...(showPayment && form.payment === "MANUAL" && form.paymentNote.trim()
          ? { paymentNote: form.paymentNote.trim() }
          : {}),
      };

      const res = await createSuperAdminCompany(payload);
      if (res?.success) {
        setResult(res.data);
        onSuccess?.();
      } else {
        setFormError(res?.message || "Could not create the company.");
      }
    } catch (err) {
      const data = err.response?.data;
      setFormError(data?.message || "Could not create the company.");
      // A pending company is blocking this email: offer to clear it.
      if (data?.data?.companyId) {
        setConfirmDelete({ companyId: data.data.companyId, message: data.data.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePending = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await deleteSuperAdminPendingCompany(confirmDelete.companyId);
      if (res?.success) {
        setConfirmDelete(null);
        setFormError("");
        onSuccess?.();
      } else {
        setDeleteError(res?.message || "Could not delete the pending company.");
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Could not delete the pending company.");
    } finally {
      setDeleting(false);
    }
  };

  const paymentUrl =
    result?.payment?.id ? `${window.location.origin}/subscription-payment/${result.payment.id}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  // ---- Result screen ----
  if (result) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="md"
        title="Company created"
        footer={
          <SAButton variant="primary" onClick={onClose}>
            Done
          </SAButton>
        }
      >
        <div className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Company</dt>
              <dd className="font-semibold text-slate-900">{result.company?.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-semibold text-slate-900">{result.subscription?.planName}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Status</dt>
              <dd>
                <SATone tone={result.company?.status === "ACTIVE" ? "emerald" : "amber"}>
                  {result.company?.status === "ACTIVE" ? "Active" : "Pending payment"}
                </SATone>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Ends</dt>
              <dd className="font-semibold text-slate-900">
                {result.subscription?.endDate
                  ? formatDate(result.subscription.endDate)
                  : "Never expires"}
              </dd>
            </div>
          </dl>

          {result.requiresPayment && paymentUrl && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-800">
                Send this link to the company to complete the payment.
              </p>
              <p className="mt-1 text-sm text-blue-800">
                Amount due: {formatFullCurrency(result.payment?.amount)}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={paymentUrl}
                  aria-label="Payment link"
                  className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-slate-700"
                />
                <SAButton
                  variant="primary"
                  onClick={copyLink}
                  className="shrink-0"
                  icon={copied ? Check : Copy}
                >
                  {copied ? "Copied" : "Copy link"}
                </SAButton>
              </div>
            </div>
          )}

          {!result.requiresPayment && (
            <p className="text-sm text-slate-600">
              The company is active and the company admin can log in with the password you set.
            </p>
          )}
        </div>
      </Modal>
    );
  }

  // ---- Form screen ----
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        title="Add company"
        description="Create a company, its first administrator and its subscription in one go."
        footer={
          <>
            <SAButton variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </SAButton>
            <SAButton variant="primary" onClick={handleSubmit} loading={saving}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Create company
            </SAButton>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {formError}
            </div>
          )}

          {/* Plan */}
          <div>
            <SASelect
              id="add-plan"
              label="Plan"
              value={form.planId}
              onChange={(e) => setField("planId", e.target.value)}
              required
              aria-invalid={errors.planId ? true : undefined}
            >
              <option value="">Select a plan…</option>
              {plans
                .filter((plan) => plan.isActive)
                .map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} —{" "}
                    {plan.billingCycle === "FREE"
                      ? "Free"
                      : formatFullCurrency(plan.price)}{" "}
                    ({planBillingLabel(plan)})
                  </option>
                ))}
            </SASelect>
            <FieldMessage id="add-plan-error" message={errors.planId} />
          </div>

          {/* Payment */}
          {showPayment && (
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Payment</legend>
              <div className="mt-2 space-y-2">
                {[
                  {
                    value: "MANUAL",
                    label: "Payment received (manual)",
                    help: "The company becomes active immediately and a manual payment of the plan price is recorded.",
                  },
                  {
                    value: "ONLINE",
                    label: "Company will pay online",
                    help: "The company stays pending until it pays on the payment page.",
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-3"
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={option.value}
                      checked={form.payment === option.value}
                      onChange={() => setField("payment", option.value)}
                      disabled={saving}
                      className="mt-0.5 h-4 w-4 border-slate-300 text-blue-800 focus:ring-2 focus:ring-blue-200"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">
                        {option.label}
                      </span>
                      <span className="block text-xs text-slate-500">{option.help}</span>
                    </span>
                  </label>
                ))}
              </div>

              {form.payment === "MANUAL" && (
                <div className="mt-3">
                  <SAInput
                    id="add-payment-note"
                    label="Payment note (optional)"
                    value={form.paymentNote}
                    onChange={(e) => setField("paymentNote", e.target.value)}
                    placeholder="Cash, bank transfer, reference…"
                    maxLength={200}
                    disabled={saving}
                  />
                </div>
              )}
            </fieldset>
          )}

          {/* Company */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-700">Company</h3>
            <SAInput
              id="add-companyName"
              label="Company name"
              value={form.companyName}
              onChange={(e) => setField("companyName", e.target.value)}
              placeholder="Acme Technologies"
              disabled={saving}
              required
              aria-invalid={errors.companyName ? true : undefined}
            />
            <FieldMessage id="add-companyName-error" message={errors.companyName} />

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <SAInput
                  id="add-companyEmail"
                  label="Company email"
                  type="email"
                  value={form.companyEmail}
                  onChange={(e) => setField("companyEmail", e.target.value)}
                  placeholder="contact@acme.com"
                  disabled={saving}
                  required
                  aria-invalid={errors.companyEmail ? true : undefined}
                />
                <FieldMessage id="add-companyEmail-error" message={errors.companyEmail} />
              </div>
              <div>
                <SAInput
                  id="add-gstNumber"
                  label="GST number (optional)"
                  value={form.gstNumber}
                  onChange={(e) => setField("gstNumber", e.target.value)}
                  placeholder="22AAAAA0000A1Z5"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="mt-3">
              <SAInput
                id="add-companyAddress"
                label="Company address"
                value={form.companyAddress}
                onChange={(e) => setField("companyAddress", e.target.value)}
                placeholder="Suite 101, Tech Park"
                disabled={saving}
                required
                aria-invalid={errors.companyAddress ? true : undefined}
              />
              <FieldMessage id="add-companyAddress-error" message={errors.companyAddress} />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <SAInput
                  id="add-city"
                  label="City"
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="Bengaluru"
                  disabled={saving}
                  required
                  aria-invalid={errors.city ? true : undefined}
                />
                <FieldMessage id="add-city-error" message={errors.city} />
              </div>
              <div>
                <SAInput
                  id="add-country"
                  label="Country"
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                  placeholder="India"
                  disabled={saving}
                  required
                  aria-invalid={errors.country ? true : undefined}
                />
                <FieldMessage id="add-country-error" message={errors.country} />
              </div>
            </div>
          </div>

          {/* Administrator */}
          <div className="space-y-1 border-t border-slate-200 pt-5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              Company administrator
            </h3>

            <SAInput
              id="add-fullName"
              label="Full name"
              value={form.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              placeholder="John Doe"
              disabled={saving}
              required
              aria-invalid={errors.fullName ? true : undefined}
            />
            <FieldMessage id="add-fullName-error" message={errors.fullName} />

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <SAInput
                  id="add-email"
                  label="Admin login email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="admin@acme.com"
                  disabled={saving}
                  required
                  aria-invalid={errors.email ? true : undefined}
                />
                <FieldMessage id="add-email-error" message={errors.email} />
              </div>
              <div>
                <SAInput
                  id="add-phoneNumber"
                  label="Phone number"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => setField("phoneNumber", e.target.value)}
                  placeholder="+919876543210"
                  disabled={saving}
                  required
                  aria-invalid={errors.phoneNumber ? true : undefined}
                />
                <FieldMessage id="add-phoneNumber-error" message={errors.phoneNumber} />
              </div>
            </div>

            <div className="mt-3">
              <label
                htmlFor="add-password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Initial password
              </label>
              <div className="relative">
                <SAInput
                  id="add-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="Set a strong password"
                  autoComplete="new-password"
                  disabled={saving}
                  required
                  className="pr-10"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "add-password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 transition-colors hover:text-slate-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <FieldMessage id="add-password-error" message={errors.password} />
              <p className="mt-1 text-xs text-slate-400">
                Share this password with the company admin securely. They can change it after logging
                in.
              </p>
            </div>
          </div>
        </form>
      </Modal>

      <InlineDeleteConfirm
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeletePending}
        saving={deleting}
        error={deleteError}
      />
    </>
  );
}
