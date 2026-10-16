import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { REPORT_LINKS } from "../../lib/reportConstants";

/**
 * Navigation for the Reports section.
 *
 * The Company Admin sidebar keeps a single "Reports" item, so the ten reports
 * are reached from here instead: a "Back to Reports" link on every report page,
 * plus the pill bar that switches between them. Both are driven from
 * `REPORT_LINKS` in `lib/reportConstants.js`, which the Reports landing page
 * also renders its cards from, so a report can never be listed in one place and
 * missing from another.
 */

/** The report matching the current path, or null on the Reports page itself. */
function findActiveReport(pathname) {
  const normalised = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  return REPORT_LINKS.find((report) => normalised === report.to) || null;
}

/**
 * Back link plus the report switcher, placed at the top of every report page.
 * Both use the same active styling as the sidebar so a page never has two
 * different ideas about which report is open.
 */
export default function ReportNav() {
  const { pathname } = useLocation();
  const active = findActiveReport(pathname);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        to="/admin/reports"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-primary-50 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Reports
      </Link>

      {/* The compact switcher. On a narrow screen it scrolls rather than
          wrapping, so it never pushes the filter bar below the fold. */}
      <nav className="scrollbar-slim min-w-0 flex-1 overflow-x-auto" aria-label="Reports">
        <ul className="flex items-center gap-1">
          {REPORT_LINKS.map((report) => {
            const isActive = report.key === active?.key;

            return (
              <li key={report.key}>
                <Link
                  to={report.to}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-primary-700 text-white shadow-sm"
                      : "text-body hover:bg-primary-50 hover:text-ink"
                  )}
                >
                  {report.label}
                  {!isActive && (
                    <ChevronRight className="ml-1 h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
