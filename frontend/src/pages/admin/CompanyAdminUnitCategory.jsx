import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Plus, Tag } from "lucide-react";
import { Button, PageHeader, Tabs } from "../../components/ui";
import CompanyAdminUnitList from "../../components/admin/CompanyAdminUnitList";
import CompanyAdminCategoryList from "../../components/admin/CompanyAdminCategoryList";

const TABS = [
  { value: "units", label: "Unit", icon: Package },
  { value: "categories", label: "Category", icon: Tag },
];

const ADD_LABELS = {
  units: "Add Unit",
  categories: "Add Category",
};

function isValidTab(value) {
  return TABS.some((tab) => tab.value === value);
}

/**
 * Single "Unit & Category" catalog page. The sidebar has one link; the active
 * section lives in the URL query so refresh and the back button preserve it.
 * Only the active list mounts, so each tab keeps its own search text, page
 * number and filters and resets them when you switch away.
 */
export default function CompanyAdminUnitCategory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = isValidTab(tabParam) ? tabParam : "units";

  // { units: statsObj, categories: statsObj } — used for the tab badges.
  const [counts, setCounts] = useState({ units: null, categories: null });

  // Points at whichever list is mounted, so the header's primary action can
  // trigger that list's create dialog.
  const listRef = useRef(null);

  const handleTabChange = useCallback(
    (next) => {
      if (next === activeTab) return;
      setSearchParams({ tab: next }, { replace: false });
    },
    [activeTab, setSearchParams]
  );

  const handleStatsChange = useCallback((tab) => (result) => {
    setCounts((previous) => ({ ...previous, [tab]: result }));
  }, []);

  return (
    <>
      <PageHeader
        title="Unit & Category"
        subtitle="Manage your measurement units and product/service categories."
        actions={
          <Button onClick={() => listRef.current?.openCreate()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {ADD_LABELS[activeTab]}
          </Button>
        }
      />

      <Tabs
        className="mb-5"
        label="Catalog sections"
        value={activeTab}
        onChange={handleTabChange}
        items={TABS.map((tab) => ({
          ...tab,
          count:
            tab.value === "units"
              ? counts.units?.totalUnits
              : counts.categories?.totalCategories,
        }))}
      />

      {activeTab === "units" && (
        <CompanyAdminUnitList ref={listRef} onStatsChange={handleStatsChange("units")} />
      )}
      {activeTab === "categories" && (
        <CompanyAdminCategoryList ref={listRef} onStatsChange={handleStatsChange("categories")} />
      )}
    </>
  );
}
