import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { cn } from "../../lib/cn";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import { CUSTOMER_NAV_GROUPS, getCustomerPageMeta } from "./customerNavConfig";
import { getCustomerProfile } from "../../api/customerDashboardApi";

/**
 * Customer dashboard shell.
 *
 * Reuses the exact company-admin shell — the same AdminSidebar and AdminHeader
 * components — parametrized for a customer (customer nav groups, no admin
 * Settings link, no global search). Company-admin behaviour is unchanged because
 * both components keep their current output when the new props are omitted.
 */
export default function CustomerLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [companyName, setCompanyName] = useState(undefined);
  const location = useLocation();

  // Read-only: used only to label the sidebar with the customer's company.
  useEffect(() => {
    let cancelled = false;
    getCustomerProfile()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setCompanyName(res.data.company?.name);
      })
      .catch(() => {
        if (!cancelled) setCompanyName(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { title } = getCustomerPageMeta(location.pathname);

  return (
    <div className="min-h-screen bg-transparent">
      <AdminSidebar
        companyName={companyName}
        collapsed={collapsed}
        onToggle={() => setCollapsed((prev) => !prev)}
        navGroups={CUSTOMER_NAV_GROUPS}
      />

      <div className={cn("transition-[padding] duration-200", collapsed ? "pl-20" : "pl-64")}>
        {/* No search box in the customer portal, so the header is told to
            right-align its trailing controls and to paint above the sidebar
            (the dropdown must not slide under the fixed sidebar). */}
        <AdminHeader title={title} settingsPath={null} showSearch={false} alignEnd raised />

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
