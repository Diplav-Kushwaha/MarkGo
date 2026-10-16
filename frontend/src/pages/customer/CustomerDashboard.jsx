import { Link } from "react-router-dom";
import { FileText, Package, ShoppingBag, User, Wrench } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Card, PageHeader } from "../../components/ui";
import { cn } from "../../lib/cn";

/**
 * Customer dashboard landing. Kept as the base route (the existing customer
 * landing route). It now renders inside the shared dashboard layout, greets the
 * customer by name and links to the read-only sections — no fabricated numbers
 * and no duplicate header (the shared AdminHeader already provides the top bar
 * with the user menu and logout).
 */

const SECTIONS = [
  {
    to: "/customer/dashboard/purchased-products",
    label: "Purchased Products",
    description: "What you have bought across your invoices.",
    icon: ShoppingBag,
  },
  {
    to: "/customer/dashboard/invoices",
    label: "Invoices",
    description: "View and print your invoices.",
    icon: FileText,
  },
  {
    to: "/customer/dashboard/products",
    label: "Products",
    description: "Browse your company's products.",
    icon: Package,
  },
  {
    to: "/customer/dashboard/services",
    label: "Services",
    description: "Browse your company's services.",
    icon: Wrench,
  },
  {
    to: "/customer/dashboard/profile",
    label: "Profile",
    description: "Your registered account details.",
    icon: User,
  },
];

export default function CustomerDashboard() {
  const { user } = useAuth();
  const firstName = (user?.name || "there").trim().split(/\s+/)[0];

  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} subtitle="A read-only portal for your invoices, purchases and catalogue." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.to} to={section.to} className="group">
              <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary-200 group-hover:shadow-card-hover">
                <div className="flex h-full flex-col p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-primary-50 text-primary-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h2 className="text-sm font-semibold text-ink">{section.label}</h2>
                  </div>
                  <p className="mt-3 text-sm text-muted">{section.description}</p>
                  <span className={cn("mt-4 text-sm font-medium text-primary-600 group-hover:underline")}>Open &rarr;</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
