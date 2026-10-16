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
import { fetchCsrfToken } from "../../api/csrfApi";
import { formatCurrency } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { billingLabel } from "../../components/subscription/planHelpers";

// Kept in step with the 409 confirmPayment raises, so the page says the same
// thing before the user presses anything.
const REPLACED_MESSAGE =
  "This payment link has been replaced by a newer purchase or is no longer valid. Please start again from your Subscription page.";

// Both actions are POSTs behind verifyCsrfToken, and this route is public, so it
// can render before AuthContext's bootstrap token request has come back. Make
// sure the double-submit cookie exists before sending one.
async function ensureCsrfToken() {
  if (/(^|;\s*)csrfToken=/.test(document.cookie)) return;
  try {
    await fetchCsrfToken();
  } catch {
    // Leave it to the POST: its 403 carries the real reason.
  }
}

function SummarySkeleton() {
  return (
    <div className="rounded-card border border-primary-100 bg-white p-8 shadow-card">
      <div className="h-6 w-48 animate-pulse rounded bg-[#E8E4F3]" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex justify-between">
            <div className="h-3.5 w-24 animate-pulse rounded bg-[#E8E4F3]" />
            <div className="h-3.5 w-32 animate-pulse rounded bg-[#E8E4F3]" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="h-11 animate-pulse rounded-control bg-[#E8E4F3]" />
        <div className="h-11 animate-pulse rounded-control bg-[#E8E4F3]" />
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
  // Errors from the two action buttons. Kept apart from `error` (which is about
  // loading the summary) so the re-read after an action cannot wipe it.
  const [actionError, setActionError] = useState("");
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
    setActionError("");
    try {
      await ensureCsrfToken();
      const res = action === "confirm" ? await confirmDummyPayment(paymentId) : await failDummyPayment(paymentId);

      if (!res.success) {
        setActionError(res.message || "Something went wrong.");
        return;
      }
      if (res.message === "Dummy payments are disabled.") {
        setDisabled(true);
        setActionError("Online payment is not available right now. Please contact support.");
        return;
      }
    } catch (err) {
      const message = err.response?.data?.message;
      if (message === "Dummy payments are disabled.") {
        setDisabled(true);
        setActionError("Online payment is not available right now. Please contact support.");
      } else {
        setActionError(message || "Something went wrong. Please try again.");
      }
    } finally {
      setPendingAction("");
      reload();
    }
  };

  const busy = pendingAction !== "";
  const status = summary?.status;
  // The backend already decided this link can never settle, so both buttons are
  // dead. Read off the summary so a re-read after a 409 keeps them disabled.
  const replaced = Boolean(summary?.replaced);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-2.5">
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
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Mark<span className="text-primary-700">Go</span>
            </span>
          </span>
        </div>

        <div className="mt-6">
          {loading || loadedId !== paymentId ? (
            <SummarySkeleton />
          ) : notFound ? (
            <div className="rounded-card border border-primary-100 bg-white p-8 text-center shadow-pop">
              <XCircle className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <h1 className="mt-3 text-lg font-bold text-ink">Payment not found</h1>
              <p className="mt-1 text-sm text-body">
                {error || "This payment link is not valid. It may have been replaced by a newer one."}
              </p>
              <Link
                to="/plans"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-control bg-[#111A3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1B2550] focus:outline-none focus:ring-4 focus:ring-primary-200"
              >
                Go to plans
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : error || !summary ? (
            <div className="rounded-card border border-primary-100 bg-white p-8 text-center shadow-pop">
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
                className="inline-flex min-h-11 items-center gap-2 rounded-control bg-[#111A3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1B2550] focus:outline-none focus:ring-4 focus:ring-primary-200"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Retry
                </button>
                <Link
                  to="/plans"
                  className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-primary-300 hover:bg-primary-50 focus:outline-none focus:ring-4 focus:ring-primary-100"
                >
                  Go to plans
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-card border border-primary-100 bg-white p-6 shadow-pop sm:p-8">
              <h1 className="text-center text-xl font-bold tracking-tight text-ink">
                Complete your payment
              </h1>

              {/* Demo notice — no card details are ever collected */}
              <div className="mt-4 flex items-start gap-2.5 rounded-tile border border-info-line bg-info-soft px-4 py-3">
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
                  <dt className="text-muted">Company</dt>
                  <dd className="text-right font-medium text-ink">
                    {summary?.companyName || "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Plan</dt>
                  <dd className="text-right font-medium text-ink">
                    {summary?.planName || "—"}
                    <span className="ml-1.5 text-xs font-normal text-muted">
                      {billingLabel({ billingCycle: summary?.billingCycle, durationMonths: null })}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                  <dt className="font-semibold text-ink">Amount</dt>
                  <dd className="text-right text-lg font-bold text-ink">
                    {formatCurrency(summary?.amount)}
                  </dd>
                </div>
              </dl>

              {/* Result banners */}
              {(error || actionError) && (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-red-600">{error || actionError}</p>
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
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#111A3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1B2550] focus:outline-none focus:ring-4 focus:ring-primary-600/20"
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

              {/* A link whose subscription was cancelled can never settle, so say
                  so before the user presses anything. */}
              {replaced && status !== "PAID" ? (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                >
                  <XCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                  <div className="text-sm text-amber-700">
                    <p>{REPLACED_MESSAGE}</p>
                    <Link
                      to={isCompanyAdmin ? "/admin/subscription" : "/plans"}
                      className="mt-2 inline-flex items-center gap-1.5 font-semibold underline"
                    >
                      {isCompanyAdmin ? "Go to Subscription" : "Choose a plan"}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ) : null}

              {/* Actions */}
              {status !== "PAID" && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => run("confirm")}
                    disabled={busy || disabled || replaced}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111A3A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1B2550] focus:outline-none focus:ring-4 focus:ring-primary-600/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                    disabled={busy || disabled || replaced}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-ink focus:outline-none focus:ring-4 focus:ring-primary-600/20 disabled:cursor-not-allowed disabled:opacity-60"
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
