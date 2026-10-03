import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  confirmDummyPayment,
  failDummyPayment,
  getPaymentSummary,
} from "../../api/subscriptionPublicApi";
import { formatCurrency } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { billingLabel } from "../../components/subscription/planHelpers";

function SummarySkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
      <div className="animate-pulse rounded-lg bg-slate-200 h-6 w-48" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex justify-between">
            <div className="animate-pulse rounded bg-slate-200 h-3.5 w-24" />
            <div className="animate-pulse rounded bg-slate-200 h-3.5 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="animate-pulse rounded-xl bg-slate-200 h-11" />
        <div className="animate-pulse rounded-xl bg-slate-200 h-11" />
      </div>
    </div>
  );
}

export default function SubscriptionPaymentPage() {
  const { paymentId } = useParams();
  const { user, role } = useAuth();
  // A company admin who is already signed in came from the Subscription page.
  const isCompanyAdmin = Boolean(user) && role === "COMPANY_ADMIN";

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  // Which button is running, so both can be disabled and only the pressed one spins.
  const [pendingAction, setPendingAction] = useState("");
  // Set when the backend reports dummy payments are switched off.
  const [disabled, setDisabled] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // Which payment id the current `summary` belongs to, so a stale summary is
  // never shown while a different payment is loading.
  const [loadedId, setLoadedId] = useState(null);

// Refresh and the post-action re-read both just bump the token. The loading
// flag is set here (a click handler) rather than inside the effect body.
const reload = useCallback(() => {
  setLoading(true);
  setReloadToken((token) => token + 1);
}, []);

useEffect(() => {
  let active = true;

  // Every branch below leaves `summary`, `notFound` and `error` in a consistent
  // state, so the render can never reach the summary with a null summary.
  getPaymentSummary(paymentId)
      .then((res) => {
        if (!active) return;
        if (res?.success && res.data) {
          setSummary(res.data);
          setLoadedId(paymentId);
          setNotFound(false);
          setError("");
        } else {
          // Resolved, but the server refused (400, 429, 5xx handled upstream).
          setSummary(null);
          setLoadedId(paymentId);
          setNotFound(true);
          setError(res?.message || "");
        }
      })
      .catch((err) => {
        if (!active) return;
        const status = err.response?.status;
        setSummary(null);
        setLoadedId(paymentId);
        if (status === 404) {
          setNotFound(true);
          setError("");
        } else {
          // Network error, 5xx, or anything else: an error state, not a
          // not-found one. The summary stays null and is never rendered.
          setNotFound(false);
          setError(
            err.response?.data?.message || "Could not load this payment."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [paymentId, reloadToken]);

  // Runs after either button: applies the result, then re-reads the summary so a
  // page refresh always shows the stored state.
  const run = async (action) => {
    setPendingAction(action);
    setError("");
    try {
      const res = action === "confirm" ? await confirmDummyPayment(paymentId) : await failDummyPayment(paymentId);

      if (!res.success) {
        setError(res.message || "Something went wrong.");
        return;
      }
      if (res.message === "Dummy payments are disabled.") {
        setDisabled(true);
        setError("Online payment is not available right now. Please contact support.");
        return;
      }
    } catch (err) {
      const message = err.response?.data?.message;
      if (message === "Dummy payments are disabled.") {
        setDisabled(true);
        setError("Online payment is not available right now. Please contact support.");
      } else {
        setError(message || "Something went wrong. Please try again.");
      }
    } finally {
      setPendingAction("");
      reload();
    }
  };

  const busy = pendingAction !== "";
  const status = summary?.status;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-white">
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
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Mark<span className="text-blue-800">Go</span>
            </span>
          </span>
        </div>

        <div className="mt-6">
          {loading || loadedId !== paymentId ? (
            <SummarySkeleton />
          ) : notFound ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
              <XCircle className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <h1 className="mt-3 text-lg font-bold text-slate-900">Payment not found</h1>
              <p className="mt-1 text-sm text-slate-500">
                {error || "This payment link is not valid. It may have been replaced by a newer one."}
              </p>
              <Link
                to="/plans"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
              >
                Go to plans
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : error || !summary ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
              <AlertCircle className="mx-auto h-8 w-8 text-red-500" aria-hidden="true" />
              <h1 className="mt-3 text-lg font-bold text-slate-900">
                Could not load this payment
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {error || "Something went wrong while loading the payment details."}
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={reload}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Retry
                </button>
                <Link
                  to="/plans"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-800 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  Go to plans
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
              <h1 className="text-center text-xl font-bold tracking-tight text-slate-900">
                Complete your payment
              </h1>

              {/* Demo notice — no card details are ever collected */}
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-800"
                  aria-hidden="true"
                />
                <p className="text-sm text-blue-800">
                  This is a demo payment. No real money is charged.
                </p>
              </div>

              {/* Order summary */}
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Company</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {summary?.companyName || "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Plan</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {summary?.planName || "—"}
                    <span className="ml-1.5 text-xs font-normal text-slate-500">
                      {billingLabel({ billingCycle: summary?.billingCycle, durationMonths: null })}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                  <dt className="font-semibold text-slate-900">Amount</dt>
                  <dd className="text-right text-lg font-bold text-slate-900">
                    {formatCurrency(summary?.amount)}
                  </dd>
                </div>
              </dl>

              {/* Result banners */}
              {error && (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {status === "PAID" ? (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center">
                  <CheckCircle2
                    className="mx-auto h-8 w-8 text-emerald-600"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-sm font-semibold text-emerald-700">
                    Payment successful. Your company is now active.
                  </p>
                  <Link
                    to={isCompanyAdmin ? "/admin/subscription" : "/admin/login"}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
                  >
                    {isCompanyAdmin ? "Back to Subscription" : "Go to login"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              ) : status === "FAILED" ? (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                >
                  <XCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-amber-700">
                    Payment failed. You can try again below.
                  </p>
                </div>
              ) : null}

              {/* Actions */}
              {status !== "PAID" && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => run("confirm")}
                    disabled={busy || disabled}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === "confirm" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Processing…
                      </>
                    ) : (
                      "Pay now"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => run("fail")}
                    disabled={busy || disabled}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === "fail" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Processing…
                      </>
                    ) : (
                      "Simulate failure"
                    )}
                  </button>
                </div>
              )}

              {status !== "PENDING" && status !== "PAID" && (
                <button
                  type="button"
                  onClick={reload}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Refresh status
                </button>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © 2026 MarkGo. All rights reserved.
        </p>
      </div>
    </div>
  );
}