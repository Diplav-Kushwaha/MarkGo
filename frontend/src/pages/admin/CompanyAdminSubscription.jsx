import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  getMySubscription,
  getMySubscriptionHistory,
  purchasePlan,
  startFree,
} from "../../api/companySubscriptionApi";
import { getPlans } from "../../api/subscriptionPublicApi";
import { formatCurrency, formatDate } from "../../lib/format";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Modal,
  PageHeader,
  Skeleton,
} from "../../components/ui";
import PlanChoiceCard from "../../components/subscription/PlanChoiceCard";
import UsageBar from "../../components/subscription/UsageBar";
import SubscriptionStatusBadge from "../../components/subscription/SubscriptionStatusBadge";
import {
  LIMIT_ROWS,
  billingLabel,
  createdByLabel,
  daysLeftLabel,
  neverExpires,
  periodText,
} from "../../components/subscription/subscriptionHelpers";

const PAGE_SIZE = 10;

/** Coloured banner for the subscription state the backend reported. */
function StateBanner({ state, subscription }) {
  const tone = {
    VALID: {
      wrap: "border-emerald-200 bg-emerald-50",
      text: "text-emerald-700",
      icon: CheckCircle2,
      title: "Your subscription is active.",
      body: neverExpires(subscription?.endDate)
        ? "Your plan never expires."
        : `Your plan runs until ${formatDate(subscription.endDate)}.`,
    },
    EXPIRED: {
      wrap: "border-red-200 bg-red-50",
      text: "text-red-700",
      icon: AlertTriangle,
      title: "Your subscription has expired.",
      body: `It ended on ${formatDate(subscription?.endDate)}. Choose a plan below to carry on.`,
    },
    PAYMENT_PENDING: {
      wrap: "border-amber-200 bg-amber-50",
      text: "text-amber-700",
      icon: Wallet,
      title: "Payment pending.",
      body: "Finish the payment to activate your plan. Buying again replaces the pending one.",
    },
    NO_SUBSCRIPTION: {
      wrap: "border-amber-200 bg-amber-50",
      text: "text-amber-700",
      icon: Info,
      title: "No subscription yet.",
      body: "Choose a plan below, or start with Free.",
    },
    COMPANY_INACTIVE: {
      wrap: "border-amber-200 bg-amber-50",
      text: "text-amber-700",
      icon: AlertTriangle,
      title: "Your company is inactive. Please contact platform support.",
      body: "Buying or switching plans is unavailable while your company is inactive.",
    },
  }[state];

  if (!tone) return null;
  const Icon = tone.icon;

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${tone.wrap}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.text}`} aria-hidden="true" />
      <div>
        <p className={`text-sm font-semibold ${tone.text}`}>{tone.title}</p>
        <p className={`mt-0.5 text-sm ${tone.text}`}>{tone.body}</p>
      </div>
    </div>
  );
}

export default function CompanyAdminSubscription() {
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState(null);
  const [state, setState] = useState("");
  const [limits, setLimits] = useState(null);
  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);

  const [history, setHistory] = useState({ items: [], pagination: null });
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Which request is in flight, so only the right button shows a spinner and
  // double clicks cannot fire two purchases.
  const [busyAction, setBusyAction] = useState("");
  const [confirm, setConfirm] = useState(null);
  // Bumped by Refresh and after a successful switch, to re-run both loads.
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setHistoryLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let active = true;

    getMySubscription()
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setSubscription(res.data.subscription);
          setState(res.data.state);
          setLimits(res.data.limits);
          setUsage(res.data.usage);
        } else {
          setError(res.message || "Could not load your subscription.");
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.message || "Could not load your subscription.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    getPlans()
      .then((res) => {
        if (active && res.success) {
          setPlans(Array.isArray(res.data?.plans) ? res.data.plans : []);
        } else if (active) {
          setError(res.message || "Could not load the plan list.");
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.response?.data?.message || "Could not load the plan list.");
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;

    getMySubscriptionHistory({ page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setHistory({
            items: res.data.items || [],
            pagination: res.data.pagination || null,
          });
        } else {
          setError(res.message || "Could not load your subscription history.");
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.message || "Could not load your subscription history.");
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, reloadKey]);

  const isInactive = state === "COMPANY_INACTIVE";
  const onFreePlan = subscription?.billingCycle === "FREE";
  // A valid paid plan with time still on it is what makes a purchase lossy.
  const hasPaidDaysLeft =
    state === "VALID" && !onFreePlan && (subscription?.daysLeft ?? 0) > 0;

  const runPurchase = async (plan) => {
    setBusyAction(plan.id);
    setActionError("");
    try {
      const res = await purchasePlan(plan.id);
      if (res.success && res.data?.payment?.id) {
        // The dummy payment page settles it; no session state changes here.
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
        setSuccessMsg("You are now on the Free plan.");
        setConfirm(null);
        reload();
      } else {
        setActionError(res.message || "Could not switch to the Free plan.");
      }
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Could not switch to the Free plan."
      );
      setConfirm(null);
    } finally {
      setBusyAction("");
    }
  };

  // Both actions confirm first when days would be lost.
  const onBuy = (plan) => {
    if (hasPaidDaysLeft) {
      setConfirm({
        kind: "purchase",
        plan,
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
        kind: "free",
        plan: null,
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
          Switch to Free
        </Button>
      );
    }

    // "Renew" when this is the paid plan already in force, "Buy plan" otherwise.
    const label = plan.id === subscription?.planId ? "Renew plan" : "Buy plan";

    return (
      <Button className="w-full" onClick={() => onBuy(plan)} disabled={disabled} loading={busy}>
        {label}
      </Button>
    );
  };

  const pagination = history.pagination;
  const totalItems = pagination?.total ?? 0;
  const from = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalItems);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription"
        subtitle="Your current plan, how much of it you are using, and your billing history."
        actions={
          <Button variant="secondary" onClick={reload}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert title="Could not load your subscription">
          {error}
        </Alert>
      )}
      {actionError && <Alert>{actionError}</Alert>}
      {successMsg && <Alert tone="success">{successMsg}</Alert>}

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <StateBanner state={state} subscription={subscription} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Current plan */}
            <Card>
              <CardHeader title="Current plan" />
              <CardBody>
                {!subscription ? (
                  <p className="text-sm text-body">
                    You are not on a plan yet. Choose one below to get started.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-base font-semibold text-ink">
                        {subscription.planName}
                      </span>
                      <SubscriptionStatusBadge status={state === "EXPIRED" ? "EXPIRED" : subscription.status} />
                    </div>

                    <dl className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-body">Billing</dt>
                        <dd className="text-ink">
                          {billingLabel({
                            billingCycle: subscription.billingCycle,
                            durationMonths: null,
                          })}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-body">Price paid</dt>
                        <dd className="font-medium text-ink">
                          {formatCurrency(subscription.priceAtPurchase)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-body">Started</dt>
                        <dd className="text-ink">{formatDate(subscription.startDate)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-body">Renews / ended</dt>
                        <dd className="text-ink">
                          {neverExpires(subscription.endDate)
                            ? "Never expires"
                            : formatDate(subscription.endDate)}
                        </dd>
                      </div>
                      {!neverExpires(subscription.endDate) && (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-body">Time remaining</dt>
                          <dd
                            className={`font-medium ${
                              (subscription.daysLeft ?? 0) <= 7
                                ? "text-amber-600"
                                : "text-ink"
                            }`}
                          >
                            {daysLeftLabel(subscription.daysLeft)}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {!neverExpires(subscription.endDate) &&
                      (subscription.daysLeft ?? 0) <= 7 && (
                        <p className="text-xs text-amber-600">
                          Your plan is close to its end date. Renew soon to avoid a lapse.
                        </p>
                      )}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Usage */}
            <Card>
              <CardHeader
                title="Usage"
                subtitle="How much of each limit this workspace currently uses."
              />
              <CardBody>
                {!usage || !limits ? (
                  <p className="text-sm text-body">No usage data available.</p>
                ) : (
                  <div className="divide-y divide-line">
                    {LIMIT_ROWS.map((row) => (
                      <UsageBar
                        key={row.key}
                        label={row.label}
                        used={usage[row.key]}
                        limit={limits[row.key] ?? null}
                      />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Plans */}
          <Card>
            <CardHeader
              title="Plans"
              subtitle="Upgrade, renew, or move to the Free plan at any time."
            />
            <CardBody>
              {plans.length === 0 ? (
                <p className="py-6 text-center text-sm text-body">
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
            </CardBody>
          </Card>
        </>
      )}

      {/* History */}
      <Card>
        <CardHeader
          title="Subscription history"
          subtitle="Every plan this company has been on."
        />
        <CardBody>
          {historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : history.items.length === 0 ? (
            <EmptyState
              title="No subscription history yet."
              description="Once this company buys or starts a plan, it will appear here."
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-slate-50">
                    <tr>
                      {["Plan", "Period", "Price", "Status", "Started by", "Payments"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-body"
                          >
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {history.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-ink">
                          {item.planName}
                        </td>
                        <td className="px-4 py-3 text-body">
                          {periodText(item.startDate, item.endDate)}
                        </td>
                        <td className="px-4 py-3 text-ink">
                          {formatCurrency(item.priceAtPurchase)}
                        </td>
                        <td className="px-4 py-3">
                          <SubscriptionStatusBadge status={item.effectiveStatus} />
                        </td>
                        <td className="px-4 py-3 text-body">
                          {createdByLabel(item.createdBy)}
                        </td>
                        <td className="px-4 py-3">
                          {item.payments.length === 0 ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <ul className="space-y-1">
                              {item.payments.map((payment) => (
                                <li key={`${item.id}-${payment.createdAt}`} className="flex items-center gap-2">
                                  <span className="font-medium text-ink">
                                    {formatCurrency(payment.amount)}
                                  </span>
                                  <SubscriptionStatusBadge status={payment.status} />
                                  <span className="text-xs text-muted">
                                    {payment.paymentMethod || "—"} ·{" "}
                                    {formatDate(payment.paidAt || payment.createdAt)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-line lg:hidden">
                {history.items.map((item) => (
                  <li key={item.id} className="py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-ink">{item.planName}</span>
                      <SubscriptionStatusBadge status={item.effectiveStatus} />
                    </div>
                    <p className="mt-1 text-sm text-body">
                      {periodText(item.startDate, item.endDate)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {formatCurrency(item.priceAtPurchase)} · started by{" "}
                      {createdByLabel(item.createdBy)}
                    </p>
                    {item.payments.map((payment) => (
                      <p
                        key={`${item.id}-m-${payment.createdAt}`}
                        className="mt-2 flex flex-wrap items-center gap-2 text-sm"
                      >
                        <span className="font-medium text-ink">
                          {formatCurrency(payment.amount)}
                        </span>
                        <SubscriptionStatusBadge status={payment.status} />
                        <span className="text-xs text-muted">
                          {payment.paymentMethod || "—"} ·{" "}
                          {formatDate(payment.paidAt || payment.createdAt)}
                        </span>
                      </p>
                    ))}
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-sm text-body">
                  Showing <span className="font-medium text-ink">{from}</span> to{" "}
                  <span className="font-medium text-ink">{to}</span> of{" "}
                  <span className="font-medium text-ink">{totalItems}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || busyAction !== ""}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pagination || page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Confirm dialog */}
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
            <Button
              onClick={() => confirm?.run()}
              loading={busyAction !== ""}
            >
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
