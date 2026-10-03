import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, ShieldCheck, UserCog } from "lucide-react";
import { Button, PageHeader, Tabs } from "../../components/ui";
import CompanyAdminStaff from "./CompanyAdminStaff";
import CompanyAdminAccountant from "./CompanyAdminAccountant";

const TABS = [
  { value: "staff", label: "Staff", icon: UserCog },
  { value: "accountant", label: "Accountants", icon: ShieldCheck },
];

const ADD_LABELS = {
  staff: "Add Staff",
  accountant: "Add Accountant",
};

function isValidTab(value) {
  return TABS.some((tab) => tab.value === value);
}

/**
 * Single Team page. The sidebar has one "Team" link; the active role lives in
 * the URL query so refresh and the back button preserve it.
 */
export default function CompanyAdminTeamPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const roleParam = searchParams.get("role");
  const activeTab = isValidTab(roleParam) ? roleParam : "staff";

  const [counts, setCounts] = useState({ staff: null, accountant: null });

  // Points at whichever list is mounted, so the header's primary action can
  // trigger that list's create dialog.
  const listRef = useRef(null);

  const handleTabChange = useCallback(
    (next) => {
      if (next === activeTab) return;
      setSearchParams({ role: next }, { replace: false });
    },
    [activeTab, setSearchParams]
  );

  const handleStatsChange = useCallback((role) => (result) => {
    setCounts((previous) => ({ ...previous, [role]: result?.total ?? null }));
  }, []);

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Manage your staff and accountants"
        actions={
          <Button onClick={() => listRef.current?.openCreate()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {ADD_LABELS[activeTab]}
          </Button>
        }
      />

      <Tabs
        className="mb-5"
        label="Team roles"
        value={activeTab}
        onChange={handleTabChange}
        items={TABS.map((tab) => ({
          ...tab,
          count:
            tab.value === "staff"
              ? counts.staff?.totalStaff
              : counts.accountant?.totalAccountants,
        }))}
      />

      {/* Only the active list is mounted, so each tab keeps its own search text,
          page number and filters and resets them when you switch away. */}
      {activeTab === "staff" ? (
        <CompanyAdminStaff ref={listRef} onStatsChange={handleStatsChange("staff")} />
      ) : (
        <CompanyAdminAccountant ref={listRef} onStatsChange={handleStatsChange("accountant")} />
      )}
    </>
  );
}
