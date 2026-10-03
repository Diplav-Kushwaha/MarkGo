import { useEffect, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import {
  assignSuperAdminCompanyPlan,
  getSuperAdminPlans,
} from "../../api/superAdminSubscriptionApi";
import { formatDate, formatCurrency } from "../../lib/format";
import { orDash } from "./superadminFormat";
import {
  neverExpires,
  planBillingLabel,
  subscriptionPeriod,
} from "./superadminPlanHelpers";
import { SAButton, SAInput, SASelect } from "./SuperAdminUi";
import { Modal } from "../../components/ui";

/**
 * Assign a plan to one company. Every figure shown comes from data the page
 * behind this modal already loaded, or from the plan list — nothing is
 * calculated here.
 */
export default function AssignPlanModal({
  isOpen,
  company,
  onClose,
  onSuccess,
}) {
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState("");
  const [payment, setPayment] = useState("MANUAL");
  const [paymentNote, setPaymentNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  // Mounted only while open, so these initial values are the reset values.
  useEffect(() => {
    if (!isOpen) return;
    getSuperAdminPlans()
      .then((res) => {
        if (res?.success) {
          setPlans(Array.isArray(res.data?.plans) ? res.data.plans : []);
        } else {
          setError(res?.message || "Could not load the plan list.");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Could not load the plan list.");
      });
  }, [isOpen]);

  const selectedPlan = plans.find((plan) => plan.id === planId);
  const planIsFree = selectedPlan?.billingCycle === "FREE";
  const showPayment = Boolean(selectedPlan) && !planIsFree;

  // The subscription currently shown next to the company, as loaded by the page.
  const current = company?.subscription || null;
  const daysLost = current && current.daysLeft !== null && current.daysLeft > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!planId) {
      setError("Select a plan.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await assignSuperAdminCompanyPlan(company.id, {
        planId,
        payment: showPayment ? payment : "MANUAL",
        ...(showPayment && payment === "MANUAL" && paymentNote.trim()
          ? { paymentNote: paymentNote.trim() }
          : {}),
      });

      if (res?.success) {
        setSuccess(res.data);
        onSuccess?.();
      } else {
        setError(res?.message || "Could not assign the plan.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not assign the plan.");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    const replaced = success.replaced;
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="sm"
        title="Plan assigned"
        footer={
          <SAButton variant="primary" onClick={onClose}>
            Done
          </SAButton>
        }
      >
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Plan</dt>
            <dd className="font-semibold text-slate-900">{success.subscription?.planName}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Price paid</dt>
            <dd className="font-semibold text-slate-900">
              {formatCurrency(success.subscription?.priceAtPurchase)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Ends</dt>
            <dd className="font-semibold text-slate-900">
              {success.subscription?.endDate
                ? formatDate(success.subscription.endDate)
                : "Never expires"}
            </dd>
          </div>
        </dl>

        {replaced?.daysLost > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            {replaced.daysLost} day{replaced.daysLost === 1 ? "" : "s"} on {replaced.planName} were
            replaced.
          </p>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Assign plan"
      description={company?.name}
      footer={
        <>
          <SAButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </SAButton>
          <SAButton variant="primary" onClick={handleSubmit} loading={saving}>
            Assign plan
          </SAButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {error}
          </div>
        )}

        {/* Current subscription, as already loaded by the page */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Current subscription
          </p>
          {current ? (
            <div className="mt-1 space-y-0.5 text-sm">
              <p className="font-semibold text-slate-900">{orDash(current.planName)}</p>
              <p className="text-slate-600">
                {subscriptionPeriod(current.startDate, current.endDate)}
              </p>
              <p className="text-xs text-slate-500">
                {neverExpires(current.endDate)
                  ? "Never expires"
                  : `${current.daysLeft} day(s) left`}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-600">This company has no subscription yet.</p>
          )}
        </div>

        {/* Warnings, all from values the backend already returned */}
        {daysLost && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <p className="text-sm text-amber-700">
              This company has {current.daysLeft} day{current.daysLeft === 1 ? "" : "s"} left on{" "}
              {current.planName}. Assigning a plan starts a fresh period from today and the remaining
              days are lost.
            </p>
          </div>
        )}

        {company?.status === "PENDING_PAYMENT" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-800" aria-hidden="true" />
            <p className="text-sm text-blue-800">Assigning a plan will activate this company.</p>
          </div>
        )}

        {company?.status === "SUSPENDED" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <p className="text-sm text-slate-600">
              The company stays inactive. Activate it separately if needed.
            </p>
          </div>
        )}

        <SASelect
          id="assign-plan"
          label="Plan"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          required
        >
          <option value="">Select a plan…</option>
          {plans
            .filter((plan) => plan.isActive)
            .map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} —{" "}
                {plan.billingCycle === "FREE" ? "Free" : formatCurrency(plan.price)}{" "}
                ({planBillingLabel(plan)})
              </option>
            ))}
        </SASelect>

        {showPayment && (
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Payment</legend>
            <div className="mt-2 space-y-2">
              {[
                {
                  value: "MANUAL",
                  label: "Payment received (manual)",
                  help: "A manual payment of the plan price will be recorded.",
                },
                {
                  value: "NONE",
                  label: "No payment (complimentary)",
                  help: "No payment is recorded and the price paid is shown as 0.",
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-3"
                >
                  <input
                    type="radio"
                    name="assign-payment"
                    value={option.value}
                    checked={payment === option.value}
                    onChange={() => setPayment(option.value)}
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

            {payment === "MANUAL" && (
              <div className="mt-3">
                <SAInput
                  id="assign-payment-note"
                  label="Payment note (optional)"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Cash, bank transfer, reference…"
                  maxLength={200}
                  disabled={saving}
                />
              </div>
            )}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
