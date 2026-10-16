import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, LayoutDashboard, LogIn, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/cn";
import { LOGIN_OPTIONS, MARKETING_LINKS, REGISTER_PATH } from "../lib/publicLinks";

/**
 * Public marketing navbar.
 *
 * Signed out, it shows exactly four things: Home, About, a Login dropdown and
 * Register. The dropdown lists one option per role that has a login route in
 * App.jsx (Admin, Customer, Vendor) and reuses those routes unchanged.
 * Signed in, the layout keeps the Dashboard / Logout buttons it always had.
 *
 * The logo, the emerald button styles, the sticky header and the mobile
 * hamburger panel are all unchanged; only the signed-out items were replaced.
 */

/** Active style for the marketing links, matching the hover colour. */
function marketingLinkClass({ isActive }) {
  return cn(
    "text-sm font-semibold transition-colors hover:text-primary-700",
    isActive ? "text-primary-700" : "text-body"
  );
}

export default function Navbar() {
  const { isAuthenticated, role, user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);
  const [mobileLoginOpen, setMobileLoginOpen] = useState(false);
  const loginMenuRef = useRef(null);

  // Close the Login dropdown on an outside click and on Escape.
  useEffect(() => {
    if (!loginMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (loginMenuRef.current && !loginMenuRef.current.contains(event.target)) {
        setLoginMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setLoginMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [loginMenuOpen]);

  // Hide the navbar when a Company Admin, Customer, or Vendor is logged in
  if (
    isAuthenticated &&
    (role === "COMPANY_ADMIN" ||
      role === "CUSTOMER" ||
      role === "VENDOR")
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
      : "/admin/dashboard";

  const closeMobile = () => {
    setMobileMenuOpen(false);
    setMobileLoginOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 px-4 pt-3">
      <div className="mx-auto max-w-7xl rounded-card border border-white/80 bg-white/80 px-4 shadow-card backdrop-blur-xl sm:px-6">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5" onClick={closeMobile}>
            <span className="flex h-9 w-9 items-center justify-center rounded-control bg-[#111A3A] text-white shadow-sm">
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
            <span className="text-lg font-bold tracking-tight text-ink">
              MARK<span className="text-primary-700">GO</span>
            </span>
          </Link>

          {/* Public pages */}
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {MARKETING_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                // "/" must not stay active on every other route.
                end={link.to === "/"}
                className={marketingLinkClass}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {!isAuthenticated ? (
              <>
                {/* Login dropdown */}
                <div className="relative hidden md:block" ref={loginMenuRef}>
                  <button
                    type="button"
                    onClick={() => setLoginMenuOpen((open) => !open)}
                    aria-expanded={loginMenuOpen}
                    aria-haspopup="menu"
                    aria-controls="login-menu"
                    className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-primary-50 hover:text-primary-800"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Login
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", loginMenuOpen && "rotate-180")}
                      aria-hidden="true"
                    />
                  </button>

                  {loginMenuOpen && (
                    <div
                      id="login-menu"
                      role="menu"
                      aria-label="Choose how to sign in"
                      className="absolute right-0 mt-2 w-56 overflow-hidden rounded-card border border-primary-100 bg-white py-1 shadow-pop"
                    >
                      {LOGIN_OPTIONS.map((option) => (
                        <Link
                          key={option.to}
                          to={option.to}
                          role="menuitem"
                          // Choosing an option closes the dropdown.
                          onClick={() => setLoginMenuOpen(false)}
                          className="block px-4 py-3 text-sm font-medium text-body transition-colors hover:bg-primary-50 hover:text-primary-800 focus:bg-primary-50 focus:text-primary-800 focus:outline-none"
                        >
                          {option.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <Link
                  to={REGISTER_PATH}
                  className="hidden min-h-10 items-center gap-2 rounded-control bg-[#111A3A] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1B2550] sm:inline-flex"
                >
                  Register
                </Link>
              </>
            ) : (
              <>
                <div className="hidden items-center gap-3 md:flex">
                  <span className="max-w-[180px] truncate text-sm text-body">
                    {user?.email || user?.phoneNumber || "—"}
                  </span>
                  <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-800">
                    {role}
                  </span>
                </div>

                <Link
                  to={dashboardPath}
                  className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  Dashboard
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Logout"
                  aria-label="Logout"
                  className="rounded-control p-2.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
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
              className="rounded-control p-2.5 text-body transition-colors hover:bg-primary-50 md:hidden"
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
          <div className="border-t border-line py-4 md:hidden">
            <nav className="mb-2 flex flex-col" aria-label="Main">
              {MARKETING_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    cn(
                      "rounded-control px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-100 text-primary-800"
                        : "text-body hover:bg-primary-50 hover:text-primary-700"
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            {isAuthenticated ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 px-3">
                  <span className="truncate text-sm text-body">
                    {user?.email || user?.phoneNumber || "—"}
                  </span>
                  <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-800">
                    {role}
                  </span>
                </div>
                <Link
                  to={dashboardPath}
                  onClick={closeMobile}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control border border-line bg-white px-4 py-2 text-sm font-semibold text-ink"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* Login, as an expandable group so every option fits on a phone */}
                <button
                  type="button"
                  onClick={() => setMobileLoginOpen((open) => !open)}
                  aria-expanded={mobileLoginOpen}
                  aria-controls="mobile-login-options"
                  className="flex min-h-10 w-full items-center justify-between rounded-control px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-primary-50"
                >
                  <span className="inline-flex items-center gap-2">
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Login
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", mobileLoginOpen && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>

                {mobileLoginOpen && (
                  <div id="mobile-login-options" className="mt-1 flex flex-col gap-1 rounded-tile bg-primary-50/70 p-2 pl-4">
                    {LOGIN_OPTIONS.map((option) => (
                      <Link
                        key={option.to}
                        to={option.to}
                        onClick={closeMobile}
                        className="rounded-control px-3 py-2.5 text-sm font-medium text-body transition-colors hover:bg-white hover:text-primary-700"
                      >
                        {option.label}
                      </Link>
                    ))}
                  </div>
                )}

                <Link
                  to={REGISTER_PATH}
                  onClick={closeMobile}
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-control bg-[#111A3A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1B2550]"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
