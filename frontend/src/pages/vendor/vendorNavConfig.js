import { FileText, Package, ShoppingBag, User, Wrench } from "lucide-react";

/**
 * Vendor dashboard navigation — the vendor counterpart to the admin
 * `components/admin/navConfig.js`. The shared AdminSidebar renders this (passed
 * in from VendorLayout) and the header derives its title from it, so the vendor
 * sidebar keeps the exact look, grouping and active-state styling of the admin
 * one without changing any admin code.
 *
 * Group labels are unique: AdminSidebar keys each group by its label.
 */
export const VENDOR_NAV_GROUPS = [
  {
    label: "Supply",
    items: [
      { label: "Sold Products & Services", to: "/vendor/dashboard/sold-products", icon: ShoppingBag },
      { label: "Bills", to: "/vendor/dashboard/bills", icon: FileText },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "All Products", to: "/vendor/dashboard/products", icon: Package },
      { label: "All Services", to: "/vendor/dashboard/services", icon: Wrench },
    ],
  },
  {
    label: "Account",
    items: [{ label: "Profile", to: "/vendor/dashboard/profile", icon: User }],
  },
];

export const VENDOR_NAV_ITEMS = VENDOR_NAV_GROUPS.flatMap((group) => group.items);

/** Whole-segment match, matching the admin helper: /bills/abc highlights "Bills". */
function matches(pathname, to) {
  if (pathname === to) return true;
  return pathname.startsWith(`${to}/`);
}

export function getVendorPageMeta(pathname) {
  const active = VENDOR_NAV_ITEMS.find((item) => matches(pathname, item.to));
  if (active) return { title: active.label, section: active.to, icon: active.icon };
  return { title: "Overview", section: "/vendor/dashboard" };
}
