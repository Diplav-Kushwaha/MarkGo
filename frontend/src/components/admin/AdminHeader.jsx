import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Search, Settings, User } from "lucide-react";
import { cn } from "../../lib/cn";
import { initialsOf, humanize } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { getAdminPageMeta } from "./navConfig";
import Drawer from "../ui/Drawer";

export default function AdminHeader({
  title,
  settingsPath = "/admin/settings",
  showSearch = true,
  // Customer/vendor dashboards render this header without the search box, which
  // is what normally carries `ml-auto`. `alignEnd` pushes their company label
  // and user menu to the right edge so the navbar matches the admin one.
  alignEnd = false,
  // The sidebar sits at z-30; this header defaults to z-20. When a layout has
  // no hamburger and a narrow content area, the user dropdown (w-64, anchored
  // right) can slide under the sidebar. `raised` lifts the whole header (and
  // its dropdown) above the sidebar for those layouts only.
  raised = false,
}) {
  const { user, company, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);

  // `title` overrides the admin-derived page title; the customer layout passes
  // its own so the heading matches the customer sidebar.
  const pageTitle = title ?? getAdminPageMeta(location.pathname).title;

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <header
      className={cn(
        "sticky top-3 z-20 mx-3 flex h-16 items-center gap-6 rounded-card border border-white/80 bg-white/75 px-4 shadow-sm backdrop-blur-xl sm:px-6",
        raised && "z-40"
      )}
    >
      <h1 className="shrink-0 text-lg font-bold text-ink">{pageTitle}</h1>

      {/* Global search — visual only, no search endpoint exists yet */}
      {showSearch && (
        <div className="relative ml-auto w-80">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search anything…"
            aria-label="Global search"
            onSubmit={(e) => e.preventDefault()}
            className="h-10 w-full rounded-control border border-line bg-white/80 pl-9 pr-3 text-sm text-ink transition-colors placeholder:text-muted focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/20"
          />
        </div>
      )}

      <span className="hidden max-w-40 truncate text-sm text-muted xl:inline" title={company?.name}>
        {company?.name || "Company"}
      </span>

      {/* User menu */}
      <div ref={menuRef} className={cn("relative shrink-0", alignEnd && "ml-auto")}>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={cn(
            "flex min-h-10 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3 transition-colors hover:bg-primary-50",
            menuOpen && "bg-primary-50"
          )}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800">
            {initialsOf(user?.fullName || user?.name || user?.email)}
          </span>
          <span className="hidden max-w-36 truncate text-sm font-medium text-ink lg:inline">
            {user?.fullName || user?.name || "Admin"}
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-card border border-primary-100 bg-white shadow-pop"
          >
            <div className="border-b border-line px-4 py-3">
              <p className="truncate text-sm font-medium text-ink">
                {user?.fullName || user?.name || "Admin"}
              </p>
              <p className="truncate text-xs text-muted">
                {user?.email || user?.phoneNumber || "—"}
              </p>
              <span className="mt-2 inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                {humanize(role)}
              </span>
            </div>

            <div className="p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileOpen(true);
                }}
                className="flex min-h-10 w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm text-body transition-colors hover:bg-primary-50 hover:text-ink"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Profile
              </button>

              {settingsPath && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(settingsPath);
                  }}
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm text-body transition-colors hover:bg-primary-50 hover:text-ink"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Settings
                </button>
              )}
            </div>

            <div className="border-t border-line p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <Drawer isOpen={profileOpen} onClose={() => setProfileOpen(false)} title="Your profile">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Full name</dt>
            <dd className="mt-0.5 text-ink">{user?.fullName || user?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-0.5 text-ink">{user?.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Phone</dt>
            <dd className="mt-0.5 text-ink">{user?.phoneNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Role</dt>
            <dd className="mt-0.5 text-ink">{humanize(role)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Company</dt>
            <dd className="mt-0.5 text-ink">{company?.name || "—"}</dd>
          </div>
        </dl>
      </Drawer>
    </header>
  );
}
