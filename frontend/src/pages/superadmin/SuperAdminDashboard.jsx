import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import SuperAdminCompanies from "./SuperAdminCompanies";
import SuperAdminSetting from "./SuperAdminSetting";
import SuperAdminOverview from "../../components/superadmin/SuperAdminOverview";
import SuperAdminPlans from "./SuperAdminPlans";
import SuperAdminSubscriptions from "./SuperAdminSubscriptions";
import { SAButton, SACard, SATone } from "../../components/superadmin/SuperAdminUi";

const NAV_TABS = [
  { id: "Overview", label: "Overview" },
  { id: "Companies", label: "Companies" },
  { id: "Plans", label: "Plans" },
  { id: "Subscriptions", label: "Subscriptions" },
  { id: "Settings", label: "Settings" },
];

export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState("Overview");

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        {/* Page header */}
        <SACard className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <SATone tone="primary" icon={ShieldCheck}>
                Root console
              </SATone>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Super Admin Control Plane
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Global tenant oversight and system administration
              </p>
            </div>

            <SAButton variant="danger" onClick={logout} className="self-start sm:self-auto">
              Logout console
            </SAButton>
          </div>
        </SACard>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div role="tablist" aria-label="Console sections" className="flex gap-1">
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? "border-blue-800 text-blue-800"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab panels */}
        {activeTab === "Overview" && <SuperAdminOverview onNavigateTab={setActiveTab} />}
        {activeTab === "Companies" && <SuperAdminCompanies />}
        {activeTab === "Plans" && <SuperAdminPlans />}
        {activeTab === "Subscriptions" && <SuperAdminSubscriptions />}
        {activeTab === "Settings" && <SuperAdminSetting />}
      </div>
    </div>
  );
}
