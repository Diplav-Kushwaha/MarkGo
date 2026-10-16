import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "../../lib/cn";
import { ADMIN_NAV_GROUPS } from "./navConfig";

function CompanyMark({ className }) {
  return (
    <svg viewBox="0 0 40 32" fill="none" stroke="currentColor" className={className} aria-hidden="true">
      <path d="M4 6L11 26L18 6" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M22 6C22 6 28 6 31 11C34 16 34 21 31 26C28 26 22 26 22 26"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminSidebar({ companyName, collapsed, onToggle, navGroups = ADMIN_NAV_GROUPS }) {
  return (
    <aside
      className={cn(
        "fixed inset-y-3 left-0 z-30 flex flex-col rounded-r-card border border-primary-100 bg-white shadow-card transition-[width] duration-200",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-line",
          collapsed ? "justify-center px-3" : "gap-2.5 px-5"
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[#111A3A] text-white shadow-sm">
          <CompanyMark className="h-5 w-5" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">MarkGo</p>
            <p className="truncate text-xs text-muted" title={companyName}>
              {companyName || "Company"}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="scrollbar-slim flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          "group relative flex min-h-11 items-center rounded-control text-sm font-semibold transition-colors",
                          collapsed ? "justify-center px-2" : "gap-3 px-3",
                          isActive
                            ? "bg-primary-100 text-primary-800 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r-full before:bg-primary-600"
                            : "text-body hover:bg-primary-50 hover:text-ink"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn(
                              "h-4.5 w-4.5 shrink-0",
                              isActive ? "text-primary-700" : "text-muted group-hover:text-ink"
                            )}
                            aria-hidden="true"
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-line p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex min-h-10 w-full items-center rounded-control py-2 text-sm text-muted transition-colors hover:bg-primary-50 hover:text-ink",
            collapsed ? "justify-center" : "gap-3 px-3"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4.5 w-4.5" aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose className="h-4.5 w-4.5" aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
