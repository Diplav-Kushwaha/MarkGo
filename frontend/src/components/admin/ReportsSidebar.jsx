import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { REPORT_CATALOGUE, REPORT_LINKS } from "../../lib/reportConstants";

/**
 * Reports sub-navigation.
 *
 * Replaces the old scrollable pill bar and "Back to Reports" link. It renders
 * once (inside ReportsLayout), not once per report page. It reuses the main
 * sidebar's palette (bg-nav / nav-active / nav-hover / nav-text / nav-muted),
 * its NavLink active styling and icon shape, but sits narrower beside the
 * content as a clearly secondary sub-menu.
 *
 * Desktop (lg and up): a fixed-width, sticky column.
 * Tablet / mobile (below lg): a compact "Reports menu" button showing the
 * current report, which opens the same grouped list. It closes on selection,
 * outside click and Escape.
 *
 * NavLink sets aria-current="page" on the active item automatically, and the
 * <nav> carries an aria-label, so the active state is exposed to assistive
 * technology rather than by colour alone.
 */

function ReportGroupList({ onNavigate }) {
  return REPORT_CATALOGUE.map((section) => (
    <div key={section.group} className="mb-4 last:mb-0">
      <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-nav-muted">{section.group}</p>
      <ul className="space-y-0.5">
        {section.items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "group flex min-h-10 items-center gap-2.5 rounded-control px-3 py-2 text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-primary-100 text-primary-800"
                      : "text-body hover:bg-primary-50 hover:text-ink"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-primary-700" : "text-muted group-hover:text-ink"
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  ));
}

export default function ReportsSidebar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const activeReport = REPORT_LINKS.find((report) => pathname === report.to);
  const currentLabel = activeReport?.label || "Reports";

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <>
      {/* Desktop: fixed-width column, sticky while the report scrolls. */}
      <aside className="scrollbar-slim sticky top-6 hidden max-h-[calc(100vh-3rem)] w-56 shrink-0 flex-col overflow-y-auto rounded-card border border-primary-100 bg-white shadow-card lg:flex">
        <div className="shrink-0 border-b border-line px-4 py-4">
          <p className="text-sm font-bold text-ink">Reports</p>
        </div>
        <nav aria-label="Reports" className="flex-1 px-2 py-3">
          <ReportGroupList />
        </nav>
      </aside>

      {/* Tablet / mobile: compact dropdown button; the same grouped list. */}
      <div ref={wrapRef} className="relative w-full shrink-0 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="true"
          className="flex min-h-11 w-full items-center gap-2 rounded-card border border-primary-100 bg-white px-3 py-2.5 text-left text-sm font-semibold text-ink shadow-card transition-colors hover:bg-primary-50"
        >
          <BarChart3 className="h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
          <span className="text-muted">Reports menu</span>
          <span className="truncate text-ink">{currentLabel}</span>
          <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[70vh] overflow-y-auto rounded-card border border-primary-100 bg-white p-2 shadow-pop scrollbar-slim">
            <nav aria-label="Reports" className="py-1">
              <ReportGroupList onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        )}
      </div>
    </>
  );
}
