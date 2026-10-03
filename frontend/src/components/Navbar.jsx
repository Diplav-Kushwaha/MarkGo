import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogIn, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * Public marketing navbar.
 *
 * NOTE: the app currently has no marketing pages — the only public routes are
 * "/" and the login/invite screens below. So there is deliberately no centre nav
 * here yet: add the links to MARKETING_LINKS (and their routes) when those pages
 * are built, rather than linking to URLs that bounce off the catch-all.
 */
const MARKETING_LINKS = [];

// Secondary portals. Grouped into one small text row instead of being spread
// across the bar, since the primary CTA is the company admin login.
const OTHER_LOGINS = [
  { label: "Staff", to: "/staff/login" },
  { label: "Accountant", to: "/accountant/login" },
  { label: "Vendor", to: "/vendor/login" },
  { label: "Customer", to: "/customer/login" },
];

export default function Navbar() {
  const { isAuthenticated, role, user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hide the navbar when a Company Admin, Customer, Vendor, Staff, or Accountant is logged in
  if (
    isAuthenticated &&
    (role === "COMPANY_ADMIN" ||
      role === "CUSTOMER" ||
      role === "VENDOR" ||
      role === "STAFF" ||
      role === "ACCOUNTANT")
  ) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const dashboardPath =
    role === "SUPERADMIN"
      ? "/superadmin/dashboard"
      : role === "CUSTOMER"
      ? "/customer/dashboard"
      : role === "VENDOR"
      ? "/vendor/dashboard"
      : role === "STAFF"
      ? "/staff/dashboard"
      : role === "ACCOUNTANT"
      ? "/accountant/dashboard"
      : "/admin/dashboard";

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5" onClick={closeMobile}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
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
            <span className="text-lg font-bold tracking-tight text-slate-900">
              MARK<span className="text-emerald-600">GO</span>
            </span>
          </Link>

          {/* Marketing links — empty until those pages exist */}
          {MARKETING_LINKS.length > 0 && (
            <nav className="hidden items-center gap-6 lg:flex" aria-label="Main">
              {MARKETING_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm font-medium text-slate-600 transition-colors hover:text-emerald-600"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-6">
            {!isAuthenticated ? (
              <>
                {/* Secondary portals, grouped as one small text row */}
                <div className="hidden items-center text-xs text-slate-500 md:flex">
                  {OTHER_LOGINS.map((link, index) => (
                    <span key={link.to} className="flex items-center">
                      {index > 0 && <span className="px-2 text-slate-300">·</span>}
                      <Link
                        to={link.to}
                        className="font-medium transition-colors hover:text-emerald-600"
                      >
                        {link.label}
                      </Link>
                    </span>
                  ))}
                </div>

                <Link
                  to="/admin/login"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Admin Login
                </Link>
              </>
            ) : (
              <>
                <div className="hidden items-center gap-3 md:flex">
                  <span className="max-w-[180px] truncate text-sm text-slate-700">
                    {user?.email}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    {role}
                  </span>
                </div>

                <Link
                  to={dashboardPath}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-600 hover:text-emerald-700"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  Dashboard
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Logout"
                  aria-label="Logout"
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-600"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            )}

            {/* Mobile toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu — only real routes */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 py-4 lg:hidden">
            {MARKETING_LINKS.length > 0 && (
              <nav className="mb-4 flex flex-col" aria-label="Main">
                {MARKETING_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={closeMobile}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-emerald-600"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            {isAuthenticated ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 px-3">
                  <span className="truncate text-sm text-slate-700">{user?.email}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    {role}
                  </span>
                </div>
                <Link
                  to={dashboardPath}
                  onClick={closeMobile}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                <Link
                  to="/admin/login"
                  onClick={closeMobile}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Admin Login
                </Link>
                {OTHER_LOGINS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={closeMobile}
                    className="rounded-lg px-3 py-2 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-emerald-600"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
