import { Outlet } from "react-router-dom";
import ReportsSidebar from "./ReportsSidebar";

/**
 * Layout for the Reports section.
 *
 * One route element wraps all ten report pages (see App.jsx), so this sidebar
 * is rendered once instead of being copy-pasted into every report page. The
 * report page content renders through the Outlet beside it.
 *
 * Desktop (lg+): sidebar is a column next to the content, which takes the rest
 * of the width (min-w-0 so a wide table scrolls inside its own container rather
 * than widening the page).
 * Below lg: the sidebar collapses to the dropdown the component renders on its
 * own, and everything stacks.
 */
export default function ReportsLayout() {
  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <ReportsSidebar />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
