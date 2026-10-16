import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  CreditCard,
  FileText,
  Layers,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  Store,
  Users,
  Wrench,
} from "lucide-react";
import { getPlans } from "../api/subscriptionPublicApi";
import { formatCurrency } from "../lib/format";
import { ADMIN_LOGIN_PATH, REGISTER_PATH, registerPathForPlan } from "../lib/publicLinks";
import {
  LIMIT_ROWS,
  billingLabel,
  isFreePlan,
  limitLabel,
} from "../components/subscription/planHelpers";

/**
 * Public About page (route /about).
 *
 * Describes what MarkGo is, what the product actually does today and how the
 * three roles work, then finishes with a Plans section. The plan cards are fed
 * by the public, unauthenticated `GET /api/plans` endpoint through
 * `subscriptionPublicApi` — the same call the plans page uses — so no price,
 * limit or feature is invented here and no authenticated endpoint is touched.
 *
 * Every link points at a route that already exists in App.jsx.
 */

/** Modules inside the company admin workspace, taken from the admin sidebar. */
const MODULES = [
  {
    icon: ClipboardList,
    title: "Dashboard",
    description:
      "A single screen showing total receivable, total payable, this month's sales and this month's expenses, alongside the latest invoices.",
  },
  {
    icon: BarChart3,
    title: "Reports",
    description:
      "Sales and outstanding reports for any date range, generated as printable documents for your records.",
  },
  {
    icon: Users,
    title: "Customers",
    description:
      "Your customer records in one company-wide book, ready to invoice and to invite into the customer portal.",
  },
  {
    icon: FileText,
    title: "Invoices",
    description:
      "Create invoices from your products and services, with tax modes and tax rates applied per line item, and record payments against them.",
  },
  {
    icon: Store,
    title: "Vendors",
    description:
      "Your supplier records, ready to raise bills against and to invite into the vendor portal.",
  },
  {
    icon: Receipt,
    title: "Bills",
    description:
      "Record bills from vendors and the payments you make against them, so payables stay accurate.",
  },
  {
    icon: Package,
    title: "Products",
    description:
      "Purchase and selling prices with tax modes, stock on hand, discounts, brand and HSN/SAC codes.",
  },
  {
    icon: Wrench,
    title: "Services",
    description:
      "A service code, unit, category, selling price and tax rate for everything you bill that never touches stock.",
  },
  {
    icon: Layers,
    title: "Unit & Category",
    description:
      "The units and categories your catalogue is measured in, managed in one place and reused everywhere.",
  },
  {
    icon: CreditCard,
    title: "Subscription",
    description:
      "See the plan your company is on, the usage against its limits, and switch plans when you need to.",
  },
  {
    icon: Settings,
    title: "Settings",
    description:
      "Your company's own details, kept in one place and used across invoices and documents.",
  },
];

/** The three roles that can sign in today, and what each one gets. */
const ROLES = [
  {
    title: "Company admin",
    description:
      "Owns the workspace: catalogue, customers, vendors, invoices, bills, payments, reports, subscription and settings.",
  },
  {
    title: "Vendor",
    description:
      "Signs in to a supplier dashboard showing their vendor profile and account details, kept separate from any other company's data.",
  },
  {
    title: "Customer",
    description:
      "Signs in to a customer dashboard with their account and billing details, so what they owe is easy to follow.",
  },
];

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Company data stays with the company",
    description:
      "Records belong to the account that created them, and every sign-in is scoped to one company, one role and one workspace.",
  },
  {
    icon: ClipboardList,
    title: "Accuracy over cleverness",
    description:
      "Tax modes are stored with each price, payments are recorded against the document they settle, and reports are generated from the same records you work with.",
  },
  {
    icon: Layers,
    title: "Simple on purpose",
    description:
      "Units, categories and catalogues are set up once and reused, so day-to-day work is entering an invoice, not configuring software.",
  },
  {
    icon: RefreshCw,
    title: "Built to keep improving",
    description:
      "The workspace grows with the business: products and services are managed the same way, and plans scale the limits rather than the features you can reach.",
  },
];

/** Loading placeholder that matches the plan-card grid. */
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

/** One plan, showing only what the public plans endpoint returns. */
function PlanCard({ plan }) {
  const free = isFreePlan(plan);

  return (
    <article className="flex flex-col rounded-card border border-primary-100 bg-white p-6 shadow-card">
      <header>
        <h4 className="text-lg font-bold text-ink">{plan.name}</h4>
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
              <dd className={`font-semibold ${unlimited ? "text-green-700" : "text-ink"}`}>
                {unlimited && <Check className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />}
                {limitLabel(value)}
              </dd>
            </div>
          );
        })}
      </dl>

      <Link
        to={registerPathForPlan(plan.id)}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-[#111A3A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1B2550]"
      >
        Get Started
      </Link>
    </article>
  );
}

export default function About() {
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    getPlans()
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setPlans(Array.isArray(res.data?.plans) ? res.data.plans : []);
          setPlansError("");
        } else {
          setPlansError(res.message || "Could not load the plans.");
        }
      })
      .catch((err) => {
        if (!active) return;
        setPlansError(err.response?.data?.message || "Could not load the plans.");
      })
      .finally(() => {
        if (active) setPlansLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  return (
    <div className="bg-transparent">
      {/* -------------------------------------------------------- Page header */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-purple-300/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="inline-flex rounded-full border border-primary-200 bg-white/75 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-800">About</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
            About MarkGo
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-body sm:text-lg">
            MarkGo is business management software for small businesses. It brings billing, the product
            and service catalogue, customers and vendors into one workspace, so the numbers a business
            runs on are recorded once and used everywhere.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6">
        {/* ---------------------------------------------------------- Mission */}
        <section className="py-16 sm:py-20">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">What MarkGo does</h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-body sm:text-base">
              <p>
                A typical day has a few moving parts: something is sold, something is bought, and
                somebody needs to know where the money stands. MarkGo keeps those parts together. Products
                are held with their stock and tax details, services with their unit, category and tax
                rate, and both can be invoiced straight from the catalogue.
              </p>
              <p>
                Customers and vendors live in the same workspace, each with the documents that belong to
                them. The dashboard answers the two questions that matter most — what is owed to the
                company and what the company owes — while sales and outstanding reports turn any date
                range into something printable for your records.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ What we offer */}
        <section className="border-t border-primary-100 py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">What we offer</h2>
            <p className="mt-3 text-sm leading-relaxed text-body sm:text-base">
              The modules inside the company admin workspace, and what each one is for.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((module) => (
              <article key={module.title} className="rounded-card border border-primary-100 bg-white/90 p-6 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-primary-50 text-primary-700">
                  <module.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink">{module.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">{module.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------- Roles */}
        <section className="border-t border-primary-100 py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">How roles work</h2>
            <p className="mt-3 text-sm leading-relaxed text-body sm:text-base">
              Three roles can sign in, each into their own workspace. Nobody sees another company's data,
              and nobody is asked to work in a screen built for somebody else.
            </p>
          </div>

          <dl className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {ROLES.map((role) => (
              <div key={role.title} className="rounded-card border border-primary-100 bg-white/90 p-6 shadow-card">
                <dt className="text-base font-semibold text-ink">{role.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-body">{role.description}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ------------------------------------------------------ Values */}
        <section className="border-t border-primary-100 py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Our approach</h2>
            <p className="mt-3 text-sm leading-relaxed text-body sm:text-base">
              The principles the product is built on, kept deliberately plain.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {VALUES.map((value) => (
              <article key={value.title} className="rounded-card border border-primary-100 bg-white/90 p-6 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-primary-50 text-primary-700">
                  <value.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">{value.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------- Plans */}
        <section className="border-t border-primary-100 py-16 sm:py-20" aria-labelledby="plans-heading">
          <div className="max-w-2xl">
            <h2 id="plans-heading" className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Plans
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-body sm:text-base">
              Each company works on a plan that sets its limits. Start on the free plan, or choose a paid
              one when the business needs more room.
            </p>
          </div>

          {plansError && (
            <div
              role="alert"
              className="mt-8 flex max-w-xl items-start justify-between gap-3 rounded-tile border border-danger-line bg-danger-soft px-4 py-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-sm text-red-700">{plansError}</p>
              </div>
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-control border border-danger-line bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-danger-soft"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </button>
            </div>
          )}

          <div className="mt-10">
            {plansLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <PlanCardSkeleton />
                <PlanCardSkeleton />
                <PlanCardSkeleton />
              </div>
            ) : plansError ? null : plans.length === 0 ? (
              <p className="rounded-card border border-primary-100 bg-white px-6 py-12 text-center text-sm text-body shadow-card">
                No plans are available right now. Please check back soon.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ------------------------------------------------ Final call to action */}
        <section className="border-t border-primary-100 py-16 sm:py-20">
          <div className="rounded-frame border border-primary-800 bg-gradient-to-br from-[#111A3A] to-[#4F46E5] px-6 py-12 text-center shadow-pop sm:px-12">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Put your billing and catalogue in one place
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
              Register your company, choose the plan that fits, and start invoicing today.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to={REGISTER_PATH}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-white px-6 py-3 text-sm font-bold text-[#111A3A] transition-colors hover:bg-primary-50 sm:w-auto"
              >
                Register your company
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <p className="text-sm text-white/80">
                Already have an account?{" "}
                <Link
                  to={ADMIN_LOGIN_PATH}
                  className="font-semibold text-white hover:text-purple-100 hover:underline underline-offset-4"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
