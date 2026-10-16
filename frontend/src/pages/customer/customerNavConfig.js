import { FileText, Package, ShoppingBag, User, Wrench } from "lucide-react";

/**
 * Customer dashboard navigation — the customer counterpart to the admin
 * `components/admin/navConfig.js`. The shared AdminSidebar renders this (passed
 * in from CustomerLayout) and the header derives its title from it, so the
 * customer sidebar keeps the exact look, grouping and active-state styling of
 * the admin one without changing any admin code.
 */
export const CUSTOMER_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { label: "Purchased Products & Services", to: "/customer/dashboard/purchased-products", icon: ShoppingBag },
      { label: "Invoices", to: "/customer/dashboard/invoices", icon: FileText },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "All Products", to: "/customer/dashboard/products", icon: Package },
      { label: "All Services", to: "/customer/dashboard/services", icon: Wrench },
    ],
  },  
  {
    label: "Account",
    items: [{ label: "Profile", to: "/customer/dashboard/profile", icon: User }],
  },
];

export const CUSTOMER_NAV_ITEMS = CUSTOMER_NAV_GROUPS.flatMap((group) => group.items);

/** Whole-segment match, matching the admin helper: /invoices/abc highlights "Invoices". */
function matches(pathname, to) {
  if (pathname === to) return true;
  return pathname.startsWith(`${to}/`);
}

export function getCustomerPageMeta(pathname) {
  const active = CUSTOMER_NAV_ITEMS.find((item) => matches(pathname, item.to));
  if (active) return { title: active.label, section: active.to, icon: active.icon };
  return { title: "Overview", section: "/customer/dashboard" };
}
