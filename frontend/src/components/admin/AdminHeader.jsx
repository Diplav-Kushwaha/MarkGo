import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Search, Settings, User } from "lucide-react";
import { cn } from "../../lib/cn";
import { initialsOf, humanize } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { getAdminPageMeta } from "./navConfig";
import Drawer from "../ui/Drawer";

export default function AdminHeader() {
  const { user, company, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);

  const { title } = getAdminPageMeta(location.pathname);

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
    <header className="sticky top-0 z-20 flex h-16 items-center gap-6 border-b border-line bg-surface px-6">
      <h1 className="shrink-0 text-base font-semibold text-ink">{title}</h1>

      {/* Global search — visual only, no search endpoint exists yet */}
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
          className="h-9 w-full rounded-lg border border-line bg-slate-50 pl-9 pr-3 text-sm text-ink transition-colors placeholder:text-muted focus:border-primary-600 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary-600/20"
        />
      </div>

      <span className="hidden max-w-40 truncate text-sm text-muted xl:inline" title={company?.name}>
        {company?.name || "Company"}
      </span>

      {/* User menu */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={cn(
            "flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2 transition-colors hover:bg-slate-100",
            menuOpen && "bg-slate-100"
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
            {initialsOf(user?.fullName || user?.name || user?.email)}
          </span>
          <span className="hidden max-w-36 truncate text-sm font-medium text-ink lg:inline">
            {user?.fullName || user?.name || "Admin"}
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
          >
            <div className="border-b border-line px-4 py-3">
              <p className="truncate text-sm font-medium text-ink">
                {user?.fullName || user?.name || "Admin"}
              </p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
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
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-body transition-colors hover:bg-slate-100 hover:text-ink"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Profile
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/admin/settings");
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-body transition-colors hover:bg-slate-100 hover:text-ink"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </button>
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
