import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Layers,
  Package,
  Receipt,
  ShieldCheck,
  Store,
  Users,
  Wrench,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ADMIN_LOGIN_PATH, REGISTER_PATH } from "../lib/publicLinks";

/**
 * Public Home page.
 *
 * Route is unchanged ("/"). Everything below describes what the app actually
 * does today — the catalogue, invoicing and billing modules that sit behind the
 * company admin sidebar — and links only to routes that already exist.
 */

/** Key features, one card each. Icons match the admin sidebar's own icons. */
const FEATURES = [
  {
    icon: Package,
    title: "Products with stock and tax",
    description:
      "Track purchase and selling prices, stock on hand, discounts, brand and HSN/SAC codes, with each price marked as tax included, tax excluded or without tax.",
  },
  {
    icon: Wrench,
    title: "Services billed by unit",
    description:
      "Services carry a service code, unit, category, selling price and tax rate — no stock levels to maintain.",
  },
  {
    icon: Layers,
    title: "Units and categories",
    description:
      "Create the units and categories your catalogue needs once, then reuse them on every product and service you add.",
  },
  {
    icon: Users,
    title: "Customers and vendors",
    description:
      "Keep your customers and vendors in one company-wide address book, invite them to their own portal, and reuse their details on every document.",
  },
  {
    icon: Receipt,
    title: "Invoices, bills and payments",
    description:
      "Raise invoices for customers and bills from vendors, then record payments against each one and watch the balances settle.",
  },
  {
    icon: BarChart3,
    title: "Reports and dashboard",
    description:
      "See total receivable, total payable and this month's sales and expenses on the dashboard, and generate sales and outstanding reports for any date range.",
  },
];

/** How it works, in the order the app actually leads you through setup. */
const STEPS = [
  {
    title: "Register your company",
    description:
      "Pick a plan and create your company account. You are signed in as the company administrator straight away.",
  },
  {
    title: "Set up units and categories",
    description:
      "Add the units you measure in and the categories you sell under, so the catalogue is ready before your first item.",
  },
  {
    title: "Add products and services",
    description:
      "Products take stock, prices and tax details; services take a service code, unit, category and tax rate.",
  },
  {
    title: "Invoice and keep track",
    description:
      "Bill your customers, record vendor bills, record payments, and follow what is owed to you and what you owe.",
  },
];

/** Who the app is for, matching the three login roles that exist today. */
const ROLES = [
  {
    icon: ShieldCheck,
    title: "Company admin",
    description: "Runs the company workspace: catalogue, customers, vendors, invoices, bills, reports and subscription.",
  },
  {
    icon: Users,
    title: "Customer",
    description: "Signs in to a customer dashboard with their account and billing details, so invoices are easy to follow.",
  },
  {
    icon: Store,
    title: "Vendor",
    description: "Signs in to a supplier dashboard with their vendor profile and account details.",
  },
];

/** Four reasons the app is built the way it is. */
const BENEFITS = [
  {
    title: "Simple to set up",
    description:
      "Register, add units and categories, and you are invoicing the same day — nothing to configure before the first sale.",
  },
  {
    title: "Access that fits each role",
    description:
      "Company admin, vendor and customer each sign in to their own workspace and see only what belongs to them.",
  },
  {
    title: "Data kept per company",
    description:
      "Every product, service, party and document belongs to your company, so one account's records never mix with another's.",
  },
  {
    title: "Tax-aware pricing",
    description:
      "Prices are stored as tax included, tax excluded or without tax, with the tax rate recorded on the item itself.",
  },
];

export default function Home() {
  const { isAuthenticated, role } = useAuth();
  const dashboardPath =
    role === "SUPERADMIN" ? "/superadmin/dashboard" : "/admin/dashboard";

  return (
    <div className="bg-transparent">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-0 -z-10 h-80 w-80 rounded-full bg-purple-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-20 -z-10 h-96 w-96 rounded-full bg-pink-200/30 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-20 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white/75 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-800 shadow-sm">
            Business management software
          </span>

          <h1 className="mx-auto mt-6 max-w-5xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-ink sm:text-5xl lg:text-6xl">
            Billing, catalogue and customers,
            <span className="mt-1 block bg-gradient-to-r from-[#1B2A8F] to-[#4F46E5] bg-clip-text text-transparent">all in one place</span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-body sm:text-lg">
            MarkGo helps small businesses manage billing, products and services, customers and vendors
            from a single workspace — invoicing and bills on one side, stock and tax-aware pricing on the
            other, and a dashboard that shows what is owed to you and what you owe.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {isAuthenticated ? (
              <Link
                to={dashboardPath}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-[#111A3A] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1B2550] sm:w-auto"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link
                  to={REGISTER_PATH}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-[#111A3A] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1B2550] sm:w-auto"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/about"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control border border-line bg-white px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50 sm:w-auto"
                >
                  Learn More
                </Link>
              </>
            )}
          </div>

          <div className="relative mx-auto mt-14 max-w-6xl pb-8 sm:mt-16">
            <svg className="absolute inset-x-0 bottom-0 h-52 w-full" viewBox="0 0 1200 240" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="markgo-hill-back" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#DCD5FF" />
                  <stop offset="1" stopColor="#F6DDF1" />
                </linearGradient>
                <linearGradient id="markgo-hill-front" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#B7B5F5" />
                  <stop offset="1" stopColor="#D9C8F6" />
                </linearGradient>
              </defs>
              <path d="M0 150C170 54 250 205 430 115S700 42 830 128s230 72 370-20v132H0Z" fill="url(#markgo-hill-back)" opacity=".75" />
              <path d="M0 192c160-84 280-14 400-50s240-84 400-12 260 62 400 0v102H0Z" fill="url(#markgo-hill-front)" opacity=".7" />
            </svg>
            <div className="relative z-10 grid min-h-64 grid-cols-1 items-center gap-4 px-2 sm:grid-cols-3 sm:px-6">
              <article className="rounded-card border border-white/80 bg-white/80 p-4 text-left shadow-pop backdrop-blur sm:translate-y-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary-700">Sample preview</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full border-[9px] border-primary-200 border-t-primary-600 border-r-indigo-500" aria-hidden="true" />
                  <div><p className="text-xs font-semibold text-ink">Sales this month</p><p className="mt-1 text-sm font-bold text-body">SAMPLE</p></div>
                </div>
              </article>
              <article className="rounded-card border border-white/80 bg-white/85 p-4 text-left shadow-pop backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary-700">Sample preview</p>
                <p className="mt-3 text-sm font-semibold text-ink">Low stock products</p>
                <ul className="mt-3 space-y-2 text-xs text-body"><li>○ Sample item</li><li>○ Sample item</li><li>○ Sample item</li></ul>
              </article>
              <article className="rounded-card border border-white/80 bg-white/80 p-4 text-left shadow-pop backdrop-blur sm:translate-y-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary-700">Sample preview</p>
                <p className="mt-3 text-sm font-semibold text-ink">Recent invoices</p>
                <p className="mt-1 text-xs text-muted">Sample entries</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-100"><div className="h-full w-2/3 rounded-full bg-primary-600" /></div>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- What you can do */}
      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            What you can do with MarkGo
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-body sm:text-base">
            Everything a small business needs to sell, buy and keep score — organised per company and
            shared only with the people who need it.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-card border border-primary-100 bg-white/90 p-6 shadow-card"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-primary-50 text-primary-700">
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-body">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- How it works */}
      <section className="border-y border-primary-100 bg-white/65 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">How it works</h2>
            <p className="mt-3 text-sm leading-relaxed text-body sm:text-base">
              Four steps from signing up to invoicing, in the order the app leads you through them.
            </p>
          </div>

          <ol className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-card border border-primary-100 bg-white p-6 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-primary-100 text-sm font-bold text-primary-800">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------------------------------------------- Who it is for */}
      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Who it is for</h2>
          <p className="mt-3 text-sm leading-relaxed text-body sm:text-base">
            MarkGo is built for the people around a business, not just the person holding the ledger.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((item) => (
            <article key={item.title} className="rounded-card border border-primary-100 bg-white/90 p-6 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-primary-50 text-primary-700">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-body">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ Why MarkGo */}
      <section className="border-y border-primary-100 bg-white/65 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Why MarkGo</h2>
            <p className="mt-3 text-sm leading-relaxed text-body sm:text-base">
              The decisions behind the product, kept simple on purpose.
            </p>
          </div>

          <dl className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="rounded-card border border-primary-100 bg-white p-6 shadow-card">
                <dt className="text-base font-semibold text-ink">{benefit.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-body">{benefit.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------- Final call to action */}
      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="rounded-frame border border-primary-800 bg-gradient-to-br from-[#111A3A] to-[#4F46E5] px-6 py-12 text-center shadow-pop sm:px-12">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Ready to get your business organised?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
            Register your company, pick the plan that fits, and start invoicing today.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={REGISTER_PATH}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-white px-6 py-3 text-sm font-bold text-[#111A3A] transition-colors hover:bg-primary-50 sm:w-auto"
            >
              Register your company
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
  );
}
