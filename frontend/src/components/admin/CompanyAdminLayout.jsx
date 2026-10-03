import { useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useAuth } from "../../context/AuthContext";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";

export default function CompanyAdminLayout() {
  const { company } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      <AdminSidebar
        companyName={company?.name}
        collapsed={collapsed}
        onToggle={() => setCollapsed((prev) => !prev)}
      />

      <div className={cn("transition-[padding] duration-200", collapsed ? "pl-20" : "pl-64")}>
        <AdminHeader />

        <main className="px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
