import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BrandMark from "./BrandMark";
import { ADMIN_LOGIN_PATH, MARKETING_LINKS, REGISTER_PATH } from "../lib/publicLinks";

/**
 * Public site footer.
 *
 * There was no footer before, so this is a new, deliberately small one: brand
 * row, the same links the public navbar shows, and a copyright line with the
 * current year. It is hidden for every signed-in role, which matches the
 * navbar's own "hide when logged in" rule and keeps the logged-in dashboards
 * exactly as they were.
 */
export default function Footer() {
  const { isAuthenticated } = useAuth();
  const year = new Date().getFullYear();

  if (isAuthenticated) return null;

  return (
    <footer className="mt-8 px-4 pb-4">
      <div className="mx-auto max-w-7xl rounded-frame border border-primary-100 bg-white/90 px-6 py-10 shadow-card backdrop-blur sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div className="max-w-sm">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-control bg-[#111A3A] text-white shadow-sm">
                <BrandMark className="h-5 w-5" title="MarkGo" />
              </span>
              <span className="text-lg font-bold tracking-tight text-ink">
                MARK<span className="text-primary-700">GO</span>
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-body">
              Business management software for small businesses: billing, products and services, customers and
              vendors, in one place.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-col gap-3" aria-label="Footer">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Navigate</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              {MARKETING_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm font-medium text-body transition-colors hover:text-primary-700"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to={ADMIN_LOGIN_PATH}
                className="text-sm font-medium text-body transition-colors hover:text-primary-700"
              >
                Login
              </Link>
              <Link
                to={REGISTER_PATH}
                className="text-sm font-medium text-body transition-colors hover:text-primary-700"
              >
                Register
              </Link>
            </div>
          </nav>
        </div>

        <div className="mt-8 border-t border-line pt-6">
          <p className="text-xs text-slate-400">© {year} MarkGo. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
