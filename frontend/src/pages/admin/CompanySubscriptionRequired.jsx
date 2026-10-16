import { useEffect, useState } from "react";import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Info, LogOut, RefreshCw, Wallet } from "lucide-react";
import {
  getMySubscription,
  purchasePlan,
  startFree,
} from "../../api/companySubscriptionApi";
import { getPlans } from "../../api/subscriptionPublicApi";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../lib/format";
import { Alert, Button, Modal } from "../../components/ui";
import PlanChoiceCard from "../../components/subscription/PlanChoiceCard";
import { daysLeftLabel } from "../../components/subscription/subscriptionHelpers";

/** Headline and helper line for each state the backend reported. */
const STATE_COPY = {
  EXPIRED: {
    title: "Your subscription has expired",
    body: (subscription) =>
      `It ended on ${formatDate(subscription?.endDate)}. Choose a plan to carry on, or start with Free.`,
    tone: "border-danger-line bg-danger-soft text-red-800",
    Icon: AlertTriangle,
  },
  NO_SUBSCRIPTION: {
    title: "Choose a plan to continue",
    body: () => "Pick a paid plan, or start with Free and upgrade whenever you like.",
    tone: "border-warning-line bg-warning-soft text-amber-800",
    Icon: Info,
  },
  PAYMENT_PENDING: {
    title: "Your payment is pending.",
    body: () => "Complete the payment to activate your plan. Buying again replaces the pending one.",
    tone: "border-warning-line bg-warning-soft text-amber-800",
    Icon: Wallet,
  },
  COMPANY_INACTIVE: {
    title: "Your company is inactive. Please contact platform support.",
    body: () => "Buying or switching plans is unavailable while your company is inactive.",
    tone: "border-warning-line bg-warning-soft text-amber-800",
    Icon: AlertTriangle,
  },
  VALID: {
    title: "Your subscription is active.",
    body: (subscription) =>
      subscription?.endDate
        ? `It runs until ${formatDate(subscription.endDate)}.`
        : "Your plan never expires.",
    tone: "border-success-line bg-success-soft text-green-800",
    Icon: CheckCircle2,
  },
};

/**
 * Where an expired or unsubscribed Company Admin lands. Deliberately rendered
 * without the Company Admin dashboard layout, because that layout is exactly
 * what a blocked company will not be able to reach.
 */
export default function CompanySubscriptionRequired() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState(null);
  const [state, setState] = useState("");
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    Promise.all([getMySubscription(), getPlans().catch(() => ({ success: false }))])
      .then(([subRes, plansRes]) => {
        if (!active) return;
        if (subRes.success) {
          setSubscription(subRes.data.subscription);
          setState(subRes.data.state);
        } else {
          setError(subRes.message || "Could not load your subscription.");
        }
        if (plansRes.success) {
          setPlans(Array.isArray(plansRes.data?.plans) ? plansRes.data.plans : []);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.message || "Could not load your subscription.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const isInactive = state === "COMPANY_INACTIVE";
  const onFreePlan = subscription?.billingCycle === "FREE";
  const hasPaidDaysLeft =
    state === "VALID" && !onFreePlan && (subscription?.daysLeft ?? 0) > 0;

  const runPurchase = async (plan) => {
    setBusyAction(plan.id);
    setActionError("");
    try {
      const res = await purchasePlan(plan.id);
      if (res.success && res.data?.payment?.id) {
        navigate(`/subscription-payment/${res.data.payment.id}`);
        return;
      }
      setActionError(res.message || "Could not start the purchase.");
    } catch (err) {
      setActionError(err.response?.data?.message || "Could not start the purchase.");
    } finally {
      setBusyAction("");
      setConfirm(null);
    }
  };

  const runStartFree = async (withConfirm) => {
    setBusyAction("free");
    setActionError("");
    try {
      const res = await startFree(withConfirm ? { confirm: true } : {});
      if (res.success) {
        setConfirm(null);
        navigate("/admin/dashboard");
      } else {
        setActionError(res.message || "Could not start with Free.");
      }
    } catch (err) {
      setActionError(err.response?.data?.message || "Could not start with Free.");
      setConfirm(null);
    } finally {
      setBusyAction("");
    }
  };

  const onBuy = (plan) => {
    if (hasPaidDaysLeft) {
      setConfirm({
        title: "Buy a new plan?",
        message: `You have ${daysLeftLabel(subscription.daysLeft)} on ${
          subscription.planName
        }. Buying a new plan starts a fresh period from today and the remaining days are lost. Continue?`,
        confirmLabel: "Continue",
        run: () => runPurchase(plan),
      });
    } else {
      runPurchase(plan);
    }
  };

  const onSwitchFree = () => {
    if (hasPaidDaysLeft) {
      setConfirm({
        title: "Switch to the Free plan?",
        message: `You still have ${daysLeftLabel(
          subscription.daysLeft
        )} on ${subscription.planName}. Switching to Free ends it now. Continue?`,
        confirmLabel: "Switch to Free",
        run: () => runStartFree(true),
      });
    } else {
      runStartFree(false);
    }
  };

  const renderPlanAction = (plan) => {
    if (isInactive) return null;
    const busy = busyAction === plan.id;
    const disabled = busyAction !== "";

    if (plan.billingCycle === "FREE") {
      if (onFreePlan) {
        return (
          <Button variant="secondary" className="w-full" disabled>
            Current plan
          </Button>
        );
      }
      return (
        <Button
          variant="secondary"
          className="w-full"
          onClick={onSwitchFree}
          disabled={disabled}
          loading={busy}
        >
          Start with Free
        </Button>
      );
    }

    return (
      <Button className="w-full" onClick={() => onBuy(plan)} disabled={disabled} loading={busy}>
        {plan.id === subscription?.planId ? "Renew plan" : "Buy plan"}
      </Button>
    );
  };

  const copy = STATE_COPY[state];
  const showPlans = !loading && state !== "VALID" && !isInactive;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Brand + logout */}
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-control bg-[#111A3A] text-white shadow-sm">
              <svg
                viewBox="0 0 40 32"
                fill="none"
                stroke="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  d="M4 6L11 26L18 6"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M22 6C22 6 28 6 31 11C34 16 34 21 31 26C28 26 22 26 22 26"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-xl font-bold tracking-tight text-ink">
              Mark<span className="text-primary-700">Go</span>
            </span>
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button variant="secondary" onClick={logout}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </Button>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {error && <Alert title="Could not load your subscription">{error}</Alert>}
          {actionError && <Alert>{actionError}</Alert>}

          {loading ? (
            <div className="space-y-4">
              <div className="h-20 w-full animate-pulse rounded-card bg-[#E8E4F3]" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="h-64 w-full animate-pulse rounded-card bg-[#E8E4F3]" />
                <div className="h-64 w-full animate-pulse rounded-card bg-[#E8E4F3]" />
                <div className="h-64 w-full animate-pulse rounded-card bg-[#E8E4F3]" />
              </div>
            </div>
          ) : copy ? (
            <>
              <div className={`flex items-start gap-3 rounded-tile border px-4 py-3 ${copy.tone}`}>
                <copy.Icon
                  className={`mt-0.5 h-5 w-5 shrink-0 ${copy.tone.split(" ")[2]}`}
                  aria-hidden="true"
                />
                <div>
                  <p className={`text-sm font-semibold ${copy.tone.split(" ")[2]}`}>
                    {copy.title}
                  </p>
                  <p className={`mt-0.5 text-sm ${copy.tone.split(" ")[2]}`}>
                    {copy.body(subscription)}
                  </p>
                </div>
              </div>

              {state === "VALID" && (
                <div className="flex justify-center">
                  <Button onClick={() => navigate("/admin/dashboard")}>
                    Go to dashboard
                  </Button>
                </div>
              )}
            </>
          ) : null}

          {showPlans && (
            <>
              {plans.length === 0 ? (
                <p className="rounded-card border border-primary-100 bg-white px-4 py-8 text-center text-sm text-body">
                  No plans are available right now. Please try again later.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {plans.map((plan) => (
                    <PlanChoiceCard
                      key={plan.id}
                      plan={plan}
                      isCurrent={plan.id === subscription?.planId}
                      action={renderPlanAction(plan)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted">
          © 2026 MarkGo. All rights reserved.
        </p>
      </div>

      <Modal
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        size="sm"
        title={confirm?.title || ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={() => confirm?.run()} loading={busyAction !== ""}>
              {confirm?.confirmLabel || "Continue"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-body">{confirm?.message}</p>
      </Modal>
    </div>
  );
}
