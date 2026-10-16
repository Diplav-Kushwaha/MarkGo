import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check, RefreshCw } from "lucide-react";
import { getPlans } from "../../api/subscriptionPublicApi";
import { formatCurrency } from "../../lib/format";
import {
  LIMIT_ROWS,
  billingLabel,
  isFreePlan,
  limitLabel,
} from "../../components/subscription/planHelpers";

/** Grey block shown while the plans load. */
function PlanCardSkeleton() {
  return (
    <div className="rounded-card border border-primary-100 bg-white p-6 shadow-card">
      <div className="h-5 w-24 animate-pulse rounded bg-[#E8E4F3]" />
      <div className="mt-4 h-8 w-32 animate-pulse rounded bg-[#E8E4F3]" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-3.5 w-full animate-pulse rounded bg-[#E8E4F3]" />
        ))}
      </div>
      <div className="mt-6 h-11 w-full animate-pulse rounded-control bg-[#E8E4F3]" />
    </div>
  );
}

function PlanCard({ plan }) {
  const free = isFreePlan(plan);

  return (
    <article className="flex flex-col rounded-card border border-primary-100 bg-white p-6 shadow-card">
      <header>
        <h2 className="text-lg font-bold text-ink">{plan.name}</h2>
        <p className="mt-1 text-xs font-medium text-muted">{billingLabel(plan)}</p>
      </header>

      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-ink">
          {free ? "Free" : formatCurrency(plan.price)}
        </span>
        {!free && <span className="text-xs text-muted">{billingLabel(plan)}</span>}
      </p>

      <dl className="mt-6 flex-1 space-y-3">
        {LIMIT_ROWS.map((row) => {
          const value = plan.limits?.[row.key] ?? null;
          const unlimited = value === null;
          return (
            <div key={row.key} className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-body">{row.label}</dt>
              <dd
                className={`font-semibold ${
                  unlimited ? "text-green-700" : "text-ink"
                }`}
              >
                {unlimited && (
                  <Check
                    className="mr-1 inline h-3.5 w-3.5 align-[-2px]"
                    aria-hidden="true"
                  />
                )}
                {limitLabel(value)}
              </dd>
            </div>
          );
        })}
      </dl>

      <Link
        to={`/register?plan=${plan.id}`}
        aria-label={`${free ? "Get started" : "Choose plan"} with ${plan.name}`}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-[#111A3A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1B2550] focus:outline-none focus:ring-4 focus:ring-primary-200"
      >
        {free ? "Get started" : "Choose plan"}
      </Link>
    </article>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  // Retry just bumps the token, so there is a single place that fetches.
  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;

    getPlans()
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setPlans(Array.isArray(res.data?.plans) ? res.data.plans : []);
          setError("");
        } else {
          setError(res.message || "Could not load plans.");
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

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Brand + heading */}
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

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink">
            Choose your plan
          </h1>
          <p className="mt-2 text-sm text-body">
            Start free, or pick a plan and pay online. No card details are needed.
          </p>

          <p className="mt-4 text-sm text-body">
            Already have an account?{" "}
            <Link
              to="/admin/login"
              className="font-semibold text-primary-800 hover:text-primary-700 hover:underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mx-auto mt-8 flex max-w-xl items-start justify-between gap-3 rounded-tile border border-danger-line bg-danger-soft px-4 py-3"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-danger"
                aria-hidden="true"
              />
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              type="button"
              onClick={retry}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-control border border-danger-line bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-danger-soft"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {/* Plans */}
        <div className="mt-10">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <PlanCardSkeleton />
              <PlanCardSkeleton />
              <PlanCardSkeleton />
            </div>
          ) : error ? null : plans.length === 0 ? (
            <p className="rounded-card border border-primary-100 bg-white px-6 py-12 text-center text-sm text-body shadow-card">
              No plans are available right now. Please try again later.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
