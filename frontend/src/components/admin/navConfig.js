import {
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Store,
  UserCog,
  Users,
} from "lucide-react";

/**
 * Single source of truth for admin navigation. The sidebar renders this and
 * the header derives the page title from it, so routes and labels can never
 * drift apart.
 */
export const ADMIN_NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Reports", to: "/admin/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Customers", to: "/admin/customers", icon: Users },
      { label: "Invoices", to: "/admin/invoices", icon: FileText },
    ],
  },
  {
    label: "Purchases",
    items: [
      { label: "Vendors", to: "/admin/vendors", icon: Store },
      { label: "Bills", to: "/admin/bills", icon: Receipt },
    ],
  },
  {
    label: "Catalog",
    items: [{ label: "Products & Services", to: "/admin/products", icon: Package }],
  },
  {
    label: "Manage",
    items: [
      { label: "Team", to: "/admin/team", icon: UserCog },
      { label: "Subscription", to: "/admin/subscription", icon: CreditCard },
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

/** Sections that live under a nav item but are not sidebar links of their own. */
const HIDDEN_SECTIONS = [{ to: "/admin/payments", label: "Payments" }];

/**
 * Matches on whole path segments so /admin/invoices/abc highlights "Invoices"
 * but /admin/invoices-archive would not.
 */
function matches(pathname, to) {
  if (pathname === to) return true;
  return pathname.startsWith(`${to}/`);
}

export function findActiveNavItem(pathname) {
  return ADMIN_NAV_ITEMS.find((item) => matches(pathname, item.to)) || null;
}

export function getAdminPageMeta(pathname) {
  const active = findActiveNavItem(pathname);
  if (active) return { title: active.label, section: active.to, icon: active.icon };

  const hidden = HIDDEN_SECTIONS.find((item) => matches(pathname, item.to));
  if (hidden) {
    const parent = findActiveNavItem("/admin/dashboard");
    return { title: hidden.label, section: "/admin/dashboard", icon: parent?.icon };
  }

  return { title: "Dashboard", section: "/admin/dashboard", icon: LayoutDashboard };
}
