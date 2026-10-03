import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Info, Pencil, Plus, Power } from "lucide-react";
import {
  createSuperAdminPlan,
  getSuperAdminPlans,
  updateSuperAdminPlan,
} from "../../api/superAdminSubscriptionApi";
import {
  formatCount,
  formatFullCurrency,
  safeNumber,
} from "../../components/superadmin/superadminFormat";
import {
  PLAN_LIMIT_ROWS,
  isUnlimited,
  limitText,
  planBillingLabel,
} from "../../components/superadmin/superadminPlanHelpers";
import {
  SAButton,
  SAEmptyState,
  SAErrorAlert,
  SAInput,
  SASelect,
  SASkeleton,
  SAStatusBadge,
} from "../../components/superadmin/SuperAdminUi";
import { Modal } from "../../components/ui";
import { cn } from "../../lib/cn";

const CYCLES = [
  { value: "FREE", label: "Free" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

const EMPTY_FORM = {
  name: "",
  billingCycle: "MONTHLY",
  price: "",
  durationMonths: "",
  maxUsers: "",
  maxStaff: "",
  maxCustomers: "",
  maxVendors: "",
  maxInvoices: "",
  isActive: true,
};

/** Client-side mirror of the backend plan rules. The backend stays authoritative. */
function validate(form, isFree) {
  const errors = {};
  const name = form.name.trim();

  if (name.length < 2) errors.name = "Plan name must be at least 2 characters.";
  else if (name.length > 60) errors.name = "Plan name must be 60 characters or fewer.";

  if (isFree) {
    if (form.price !== "" && Number(form.price) !== 0) {
      errors.price = "The Free plan must have a price of 0.";
    }
  } else {
    const price = Number(form.price);
    if (form.price === "" || Number.isNaN(price)) errors.price = "Enter a price.";
    else if (price <= 0) errors.price = "A paid plan must cost more than 0.";
    else if (price > 10000000) errors.price = "Price must be at most 10,000,000.";
    else if (Math.round(price * 100) !== price * 100) {
      errors.price = "Price may have at most 2 decimal places.";
    }
  }

  if (!isFree) {
    const duration = Number(form.durationMonths);
    if (form.durationMonths === "" || Number.isNaN(duration)) {
      errors.durationMonths = "Enter the billing period in months.";
    } else if (!Number.isInteger(duration)) {
      errors.durationMonths = "Duration must be a whole number of months.";
    } else if (duration < 1 || duration > 120) {
      errors.durationMonths = "Duration must be between 1 and 120 months.";
    }
  }

  for (const row of PLAN_LIMIT_ROWS) {
    const raw = form[row.key];
    if (raw === "" || raw === null || raw === undefined) continue;
    const value = Number(raw);
    if (Number.isNaN(value) || !Number.isInteger(value) || value < 0) {
      errors[row.key] = "Whole number, or empty for unlimited.";
    }
  }

  return errors;
}

/** Turn a limit field into the value the API expects: a number or null. */
function limitValue(raw) {
  if (raw === "" || raw === null || raw === undefined) return null;
  return Number(raw);
}

/**
 * Builds the alert text for a failed save. The backend answers 400 with
 * `{ success: false, message: "Validation failed.", errors: [{ field, message }] }`
 * (see backend/src/middleware/validate.js), so the field detail is appended to the
 * generic message. A response with no details keeps the message alone.
 */
function buildSaveErrorMessage(body) {
  const message = body?.message || "Could not save the plan.";
  const details = Array.isArray(body?.errors) ? body.errors : [];

  if (details.length === 0) return message;

  const detailText = details
    .map((item) => {
      const text = item?.message || "Invalid value";
      return item?.field ? `${item.field}: ${text}` : text;
    })
    .join("; ");

  return `${message} ${detailText}`;
}

/**
 * Inline message for a field. SAInput does not take an `error` prop, so the
 * message is rendered here and wired to the control with aria-describedby.
 */
function FieldMessage({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-600">
      {message}
    </p>
  );
}

export default function SuperAdminPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Deactivate confirmation
  const [confirmOff, setConfirmOff] = useState(null);
  const [toggling, setToggling] = useState(false);

  const retry = useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let active = true;

    getSuperAdminPlans()
      .then((res) => {
        if (!active) return;
        if (res?.success) {
          setPlans(Array.isArray(res.data?.plans) ? res.data.plans : []);
          setError("");
        } else {
          setError(res?.message || "Could not load plans.");
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.message || "Could not load plans.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  // The backend allows exactly one Free plan, so the option disappears once one
  // exists.
  const freeExists = useMemo(
    () => plans.some((plan) => plan.billingCycle === "FREE"),
    [plans]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      billingCycle: freeExists ? "MONTHLY" : "MONTHLY",
      price: freeExists ? "" : "",
    });
    setFieldErrors({});
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (plan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      billingCycle: plan.billingCycle,
      price: plan.price === 0 ? "0" : String(plan.price),
      durationMonths:
        plan.durationMonths === null || plan.durationMonths === undefined
          ? ""
          : String(plan.durationMonths),
      maxUsers: isUnlimited(plan.limits?.users) ? "" : String(plan.limits.users),
      maxStaff: isUnlimited(plan.limits?.staff) ? "" : String(plan.limits.staff),
      maxCustomers: isUnlimited(plan.limits?.customers) ? "" : String(plan.limits.customers),
      maxVendors: isUnlimited(plan.limits?.vendors) ? "" : String(plan.limits.vendors),
      maxInvoices: isUnlimited(plan.limits?.invoices) ? "" : String(plan.limits.invoices),
      isActive: Boolean(plan.isActive),
    });
    setFieldErrors({});
    setFormError("");
    setFormOpen(true);
  };

  const setField = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => ({ ...previous, [key]: "" }));
    setFormError("");
  };

  const isFree = form.billingCycle === "FREE";

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    const found = validate(form, isFree);
    if (Object.keys(found).length > 0) {
      setFieldErrors(found);
      return;
    }

    setSaving(true);
    try {
      let res;
      if (editing) {
        // Send only what actually changed, and never billingCycle.
        const patch = {};

        if (form.name.trim() !== editing.name) patch.name = form.name.trim();

        const nextPrice = isFree ? 0 : Number(form.price);
        if (nextPrice !== Number(editing.price)) patch.price = nextPrice;

        // A FREE plan has no duration: never send the field for one. For a paid
        // plan send a number, but only when it actually changed.
        if (!isFree) {
          const nextDuration = Number(form.durationMonths);
          const currentDuration = Number(editing.durationMonths);
          if (Number.isFinite(nextDuration) && nextDuration !== currentDuration) {
            patch.durationMonths = nextDuration;
          }
        }

        // `dtoKey` is the short name the API returns (users, staff, …); the
        // patch itself still uses the flat max* field names.
        for (const row of PLAN_LIMIT_ROWS) {
          const next = limitValue(form[row.key]);
          const current = editing.limits?.[row.dtoKey] ?? null;
          if (next !== current) patch[row.key] = next;
        }

        if (form.isActive !== Boolean(editing.isActive)) patch.isActive = form.isActive;

        // The backend rejects an empty body with 400 "Validation failed.", so a
        // save with nothing to change must not be sent at all.
        if (Object.keys(patch).length === 0) {
          setFormError("No changes to save.");
          setSaving(false);
          return;
        }

        res = await updateSuperAdminPlan(editing.id, patch);
      } else {
        const payload = {
          name: form.name.trim(),
          billingCycle: form.billingCycle,
          price: isFree ? 0 : Number(form.price),
          durationMonths: isFree ? null : Number(form.durationMonths),
          isActive: form.isActive,
        };
        for (const row of PLAN_LIMIT_ROWS) payload[row.key] = limitValue(form[row.key]);
        res = await createSuperAdminPlan(payload);
      }

      if (res?.success) {
        setSuccessMsg(editing ? "Plan updated." : "Plan created.");
        setFormOpen(false);
        retry();
      } else {
        setFormError(buildSaveErrorMessage(res));
      }
    } catch (err) {
      setFormError(buildSaveErrorMessage(err.response?.data));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan) => {
    setToggling(true);
    try {
      const res = await updateSuperAdminPlan(plan.id, { isActive: !plan.isActive });
      if (res?.success) {
        setSuccessMsg(
          plan.isActive ? `${plan.name} deactivated.` : `${plan.name} activated.`
        );
        setConfirmOff(null);
        retry();
      } else {
        setError(res?.message || "Could not change the plan.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not change the plan.");
    } finally {
      setToggling(false);
    }
  };

  const renderCard = (plan) => {
    const planIsFree = plan.billingCycle === "FREE";
    const busy = toggling && confirmOff?.id === plan.id;

    return (
      <article
        key={plan.id}
        className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{plan.name}</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              {planBillingLabel(plan)}
            </p>
          </div>
          <SAStatusBadge status={plan.isActive ? "ACTIVE" : "INACTIVE"} />
        </header>

        <p className="mt-4 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {planIsFree ? "Free" : formatFullCurrency(plan.price)}
          </span>
          {!planIsFree && (
            <span className="text-xs text-slate-500">{planBillingLabel(plan)}</span>
          )}
        </p>

        <dl className="mt-5 space-y-2 text-sm">
          {PLAN_LIMIT_ROWS.map((row) => {
            const value = plan.limits?.[row.dtoKey] ?? null;
            return (
              <div key={row.key} className="flex items-center justify-between gap-3">
                <dt className="text-slate-600">{row.label}</dt>
                <dd
                  className={`font-semibold ${
                    isUnlimited(value) ? "text-emerald-600" : "text-slate-900"
                  }`}
                >
                  {limitText(value)}
                </dd>
              </div>
            );
          })}
        </dl>

        <p className="mt-4 text-xs text-slate-500">
          {formatCount(safeNumber(plan.activeSubscriptions))} active /{" "}
          {formatCount(safeNumber(plan.totalSubscriptions))} total subscriptions
        </p>

        <div className="mt-5 flex gap-2 border-t border-slate-200 pt-5">
          <SAButton
            variant="secondary"
            className="flex-1"
            icon={Pencil}
            onClick={() => openEdit(plan)}
            disabled={toggling}
          >
            Edit
          </SAButton>
          {plan.isActive ? (
            <SAButton
              variant="secondary"
              className="flex-1"
              icon={Power}
              onClick={() => setConfirmOff(plan)}
              disabled={toggling}
            >
              Deactivate
            </SAButton>
          ) : (
            <SAButton
              variant="primary"
              className="flex-1"
              icon={Power}
              loading={busy}
              onClick={() => handleToggleActive(plan)}
              disabled={toggling}
            >
              Activate
            </SAButton>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Plans</h1>
          <p className="mt-1 text-sm text-slate-500">
            The plans companies can subscribe to.
          </p>
        </div>
        <SAButton variant="primary" icon={Plus} onClick={openCreate} disabled={loading || toggling}>
          Create plan
        </SAButton>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-800" aria-hidden="true" />
        <p className="text-sm text-blue-800">
          Changing a plan only affects new purchases. Existing subscriptions keep their price and dates.
        </p>
      </div>

      {error && <SAErrorAlert message={error} onRetry={{ retry }} />}
      {successMsg && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SASkeleton key={index} className="h-72 w-full" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <SAEmptyState
          icon={CreditCard}
          title="No plans yet."
          description="Create a plan so companies have something to subscribe to."
          action={
            <SAButton variant="primary" icon={Plus} onClick={openCreate}>
              Create plan
            </SAButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map(renderCard)}
        </div>
      )}

      {/* Create / edit */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        size="lg"
        title={editing ? "Edit plan" : "Create plan"}
        description={
          editing
            ? "Only the fields you change are sent. Billing cycle cannot be changed."
            : "Set the price, billing period and limits companies get on this plan."
        }
        footer={
          <>
            <SAButton variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </SAButton>
            <SAButton variant="primary" onClick={handleSave} loading={saving}>
              {editing ? "Save changes" : "Create plan"}
            </SAButton>
          </>
        }
      >
        <form onSubmit={handleSave} noValidate className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {formError}
            </div>
          )}

          <SAInput
            id="plan-name"
            label="Plan name"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g. Quarterly"
            disabled={saving}
            required
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? "plan-name-error" : undefined}
          />
          <FieldMessage id="plan-name-error" message={fieldErrors.name} />

          {editing ? (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Billing cycle
              </span>
              <p className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                {CYCLES.find((c) => c.value === form.billingCycle)?.label ||
                  form.billingCycle}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Billing cycle cannot be changed.
              </p>
            </div>
          ) : (
            <SASelect
              id="plan-cycle"
              label="Billing cycle"
              value={form.billingCycle}
              onChange={(e) => setField("billingCycle", e.target.value)}
              disabled={saving}
            >
              {CYCLES.map((cycle) => (
                <option
                  key={cycle.value}
                  value={cycle.value}
                  disabled={cycle.value === "FREE" && freeExists}
                >
                  {cycle.value === "FREE" && freeExists
                    ? "Free (already exists)"
                    : cycle.label}
                </option>
              ))}
            </SASelect>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SAInput
              id="plan-price"
              label="Price"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setField("price", e.target.value)}
              placeholder="0.00"
              disabled={saving || isFree}
              required={!isFree}
              hint={isFree ? "The Free plan is always 0." : undefined}
              aria-invalid={fieldErrors.price ? true : undefined}
              aria-describedby={fieldErrors.price ? "plan-price-error" : undefined}
            />
            <FieldMessage id="plan-price-error" message={fieldErrors.price} />

            {!isFree && (
              <>
                <SAInput
                  id="plan-duration"
                  label="Billing period (months)"
                  type="number"
                  step="1"
                  min="1"
                  max="120"
                  value={form.durationMonths}
                  onChange={(e) => setField("durationMonths", e.target.value)}
                  placeholder="1"
                  disabled={saving}
                  required
                  aria-invalid={fieldErrors.durationMonths ? true : undefined}
                  aria-describedby={
                    fieldErrors.durationMonths ? "plan-duration-error" : undefined
                  }
                />
                <FieldMessage
                  id="plan-duration-error"
                  message={fieldErrors.durationMonths}
                />
              </>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Limits</p>
            <p className="mb-3 text-xs text-slate-400">
              Leave empty for unlimited.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PLAN_LIMIT_ROWS.map((row) => (
                <div key={row.key}>
                  <SAInput
                    id={`plan-${row.key}`}
                    label={row.label}
                    type="number"
                    step="1"
                    min="0"
                    value={form[row.key]}
                    onChange={(e) => setField(row.key, e.target.value)}
                    placeholder="Unlimited"
                    disabled={saving}
                    aria-invalid={fieldErrors[row.key] ? true : undefined}
                    aria-describedby={
                      fieldErrors[row.key] ? `plan-${row.key}-error` : undefined
                    }
                  />
                  <FieldMessage
                    id={`plan-${row.key}-error`}
                    message={fieldErrors[row.key]}
                  />
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField("isActive", e.target.checked)}
              disabled={saving}
              className={cn(
                "h-4 w-4 rounded border-slate-300 text-blue-800",
                "focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
              )}
            />
            <span className="text-sm text-slate-700">Active</span>
          </label>
        </form>
      </Modal>

      {/* Deactivate confirmation */}
      <Modal
        isOpen={Boolean(confirmOff)}
        onClose={() => setConfirmOff(null)}
        size="sm"
        title="Deactivate plan"
        footer={
          <>
            <SAButton variant="secondary" onClick={() => setConfirmOff(null)} disabled={toggling}>
              Cancel
            </SAButton>
            <SAButton
              variant="primary"
              onClick={() => handleToggleActive(confirmOff)}
              loading={toggling}
            >
              Deactivate
            </SAButton>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This plan will be hidden from new buyers. Companies already on it keep working until their end
          date.
        </p>
        {confirmOff?.billingCycle === "FREE" && (
          <p className="mt-3 text-sm text-amber-700">
            Companies will not be able to switch to Free while it is inactive.
          </p>
        )}
      </Modal>
    </div>
  );
}
