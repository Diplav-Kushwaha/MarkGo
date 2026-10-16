import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { formatDateLabel, orDash } from "../../components/superadmin/superadminFormat";
import { SACard, SATone } from "../../components/superadmin/SuperAdminUi";

const SETTING_TABS = ["Profile", "Security", "System"];

function StatusPill({ children, tone = "emerald" }) {
  return <SATone tone={tone}>{children}</SATone>;
}

export default function SuperAdminSetting() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("Profile");

  return (
    <SACard className="overflow-hidden rounded-card border-primary-100/70 bg-white shadow-card">
      <div className="flex flex-col md:flex-row md:min-h-[550px]">
        {/* Settings sub-navigation */}
        <aside className="border-b border-primary-100 bg-primary-50/40 p-4 md:w-56 md:border-b-0 md:border-r">
          <h2 className="mb-3 px-3 text-[11px] font-bold uppercase tracking-wider text-muted">
            Superadmin console
          </h2>
          <nav className="space-y-1">
            {SETTING_TABS.map((tab) => {
              const isActive = activeSection === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveSection(tab)}
                  aria-current={isActive ? "page" : undefined}
                  className={`min-h-11 w-full rounded-control px-3 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-primary-100 font-semibold text-primary-700"
                      : "text-body hover:bg-primary-50 hover:text-ink"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Settings content */}
        <section className="flex-1 p-6 md:p-8">
          {/* Profile */}
          {activeSection === "Profile" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-ink">Super Administrator Profile</h3>
                <p className="mt-0.5 text-sm text-muted">
                  Global root account parameters and security identity.
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-primary-100 pt-5 text-sm md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 border-b border-primary-100/70 pb-2">
                    <dt className="font-medium text-muted">Root email</dt>
                    <dd className="truncate font-semibold text-ink">{orDash(user?.email)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-primary-100/70 pb-2">
                    <dt className="font-medium text-muted">Account ID</dt>
                    <dd className="truncate rounded-control bg-primary-50 px-2 py-0.5 font-mono text-xs text-body">
                      {orDash(user?.id || user?.userId)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-primary-100/70 pb-2">
                    <dt className="font-medium text-muted">Authorization scope</dt>
                    <dd>
                      <StatusPill tone="primary">{orDash(user?.role || "SUPERADMIN")}</StatusPill>
                    </dd>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 border-b border-primary-100/70 pb-2">
                    <dt className="font-medium text-muted">Tenant scope</dt>
                    <dd className="font-medium text-emerald-600">Global (all companies)</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-primary-100/70 pb-2">
                    <dt className="font-medium text-muted">Account status</dt>
                    <dd className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                      Active root session
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-primary-100/70 pb-2">
                    <dt className="font-medium text-muted">Created date</dt>
                    <dd className="text-body">
                      {user?.createdAt ? formatDateLabel(user.createdAt) : "System init"}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          )}

          {/* Security */}
          {activeSection === "Security" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-ink">Platform Security Policies</h3>
                <p className="mt-0.5 text-sm text-muted">
                  Enforced system-wide safeguards across all tenant boundaries.
                </p>
              </div>

              <div className="space-y-4 border-t border-primary-100 pt-5">
                {[
                  {
                    title: "JWT rotation & refresh rate",
                    detail: "Short-lived 15-minute access tokens with reuse detection",
                    badge: "Enforced",
                  },
                  {
                    title: "Brute force account lockout",
                    detail: "5 failed login attempts locks the account for 15 minutes",
                    badge: "Active",
                  },
                  {
                    title: "Double-submit CSRF verification",
                    detail: "Requires a matched x-csrf-token header on all state mutations",
                    badge: "Enabled",
                  },
                ].map((policy) => (
                  <div
                    key={policy.title}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-tile border border-primary-100/70 bg-primary-50/40 p-4"
                  >
                    <div className="min-w-0">
                      <h4 className="font-semibold text-ink">{policy.title}</h4>
                      <p className="mt-0.5 text-xs text-muted">{policy.detail}</p>
                    </div>
                    <StatusPill>{policy.badge}</StatusPill>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System */}
          {activeSection === "System" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-ink">Environment Architecture</h3>
                <p className="mt-0.5 text-sm text-muted">
                  Runtime configuration and infrastructure bindings.
                </p>
              </div>

              <dl className="space-y-3 border-t border-primary-100 pt-5 text-sm">
                {[
                  ["Database engine", "MySQL 8.0 via Prisma ORM"],
                  ["Tenant isolation level", "Strict CompanyId multi-tenancy"],
                  ["Node API gateway", "Express (Helmet + CORS whitelist)"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 border-b border-primary-100/70 pb-2"
                  >
                    <dt className="text-muted">{label}</dt>
                    <dd className="truncate font-mono text-xs text-body">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      </div>
    </SACard>
  );
}
