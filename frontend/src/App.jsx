import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./guards/ProtectedRoute";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import RoleGuard from "./guards/RoleGuard";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import CompanyRegister from "./pages/admin/CompanyRegister";
import PlansPage from "./pages/subscription/PlansPage";
import SubscriptionPaymentPage from "./pages/subscription/SubscriptionPaymentPage";
import CompanyLogin from "./pages/admin/CompanyLogin";
import SuperAdminLogin from "./pages/superadmin/SuperAdminLogin";
import AcceptInvite from "./pages/customer/AcceptInvite";
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerLayout from "./pages/customer/CustomerLayout";
import AcceptVendorInvite from "./pages/vendor/AcceptVendorInvite";
import VendorLogin from "./pages/vendor/VendorLogin";
import VendorLayout from "./pages/vendor/VendorLayout";


import CompanyAdminLayout from "./components/admin/CompanyAdminLayout";
import ReportsLayout from "./components/admin/ReportsLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingScreen from "./components/LoadingScreen";

const CompanyAdminDashboardHome = lazy(() => import("./pages/admin/CompanyAdminDashboardHome"));
const CompanyAdminCustomer = lazy(() => import("./pages/admin/CompanyAdminCustomer"));
const CompanyAdminVendor = lazy(() => import("./pages/admin/CompanyAdminVendor"));
const CompanyAdminProduct = lazy(() => import("./pages/admin/CompanyAdminProduct"));
const CompanyAdminService = lazy(() => import("./pages/admin/CompanyAdminService"));
const CompanyAdminUnitCategory = lazy(() => import("./pages/admin/CompanyAdminUnitCategory"));
const CompanyAdminPayment = lazy(() => import("./pages/admin/CompanyAdminPayment"));
const CompanyAdminSetting = lazy(() => import("./pages/admin/CompanyAdminSetting"));
const CompanyAdminSubscription = lazy(() => import("./pages/admin/CompanyAdminSubscription"));
const CompanySubscriptionRequired = lazy(() => import("./pages/admin/CompanySubscriptionRequired"));
const SalesReportPage = lazy(() => import("./pages/admin/reports/SalesReportPage"));
const PurchasesReportPage = lazy(() => import("./pages/admin/reports/PurchasesReportPage"));
const TransactionsReportPage = lazy(() => import("./pages/admin/reports/TransactionsReportPage"));
const ProfitLossReportPage = lazy(() => import("./pages/admin/reports/ProfitLossReportPage"));
const SoldProductsReportPage = lazy(() => import("./pages/admin/reports/SoldProductsReportPage"));
const SoldServicesReportPage = lazy(() => import("./pages/admin/reports/SoldServicesReportPage"));
const CustomersReportPage = lazy(() => import("./pages/admin/reports/CustomersReportPage"));
const VendorsReportPage = lazy(() => import("./pages/admin/reports/VendorsReportPage"));
const ProductsReportPage = lazy(() => import("./pages/admin/reports/ProductsReportPage"));
const ServicesReportPage = lazy(() => import("./pages/admin/reports/ServicesReportPage"));
const CustomerPurchasedProducts = lazy(() => import("./pages/customer/CustomerPurchasedProducts"));
const CustomerInvoices = lazy(() => import("./pages/customer/CustomerInvoices"));
const CustomerInvoiceDetails = lazy(() => import("./pages/customer/CustomerInvoiceDetails"));
const CustomerProducts = lazy(() => import("./pages/customer/CustomerProducts"));
const CustomerServices = lazy(() => import("./pages/customer/CustomerServices"));
const CustomerProfile = lazy(() => import("./pages/customer/CustomerProfile"));
const VendorSoldProducts = lazy(() => import("./pages/vendor/VendorSoldProducts"));
const VendorBills = lazy(() => import("./pages/vendor/VendorBills"));
const VendorBillDetails = lazy(() => import("./pages/vendor/VendorBillDetails"));
const VendorProducts = lazy(() => import("./pages/vendor/VendorProducts"));
const VendorServices = lazy(() => import("./pages/vendor/VendorServices"));
const VendorProfile = lazy(() => import("./pages/vendor/VendorProfile"));
const SuperAdminDashboard = lazy(() => import("./pages/superadmin/SuperAdminDashboard"));
const SuperAdminCompanyDetails = lazy(() => import("./pages/superadmin/SuperAdminCompanyDetails"));

const loadInvoiceRoutes = () => import("./pages/admin/InvoiceRoutes");
const InvoiceListRoute = lazy(() =>
  loadInvoiceRoutes().then((routes) => ({ default: routes.InvoiceListRoute }))
);
const InvoiceNewRoute = lazy(() =>
  loadInvoiceRoutes().then((routes) => ({ default: routes.InvoiceNewRoute }))
);
const InvoiceEditRoute = lazy(() =>
  loadInvoiceRoutes().then((routes) => ({ default: routes.InvoiceEditRoute }))
);
const InvoiceDetailRoute = lazy(() =>
  loadInvoiceRoutes().then((routes) => ({ default: routes.InvoiceDetailRoute }))
);

const loadBillRoutes = () => import("./pages/admin/BillRoutes");
const BillListRoute = lazy(() =>
  loadBillRoutes().then((routes) => ({ default: routes.BillListRoute }))
);
const BillNewRoute = lazy(() =>
  loadBillRoutes().then((routes) => ({ default: routes.BillNewRoute }))
);
const BillEditRoute = lazy(() =>
  loadBillRoutes().then((routes) => ({ default: routes.BillEditRoute }))
);
const BillDetailRoute = lazy(() =>
  loadBillRoutes().then((routes) => ({ default: routes.BillDetailRoute }))
);

const layoutFallback = <LoadingScreen />;

/**
 * Wraps the route table in the error boundary.
 *
 * It lives inside <Router> so it can read the current pathname and use it as a
 * key: a page that throws is isolated, and navigating to any other route remounts
 * the boundary so the rest of the app stays usable. <AuthProvider> stays
 * outside, so a failure inside the auth bootstrap is still reported normally.
 */
function RoutesWithBoundary() {
  const location = useLocation();

  return (
    <ErrorBoundary key={location.pathname}>
      <Routes>
        {/* 1. Root & Public Auth Routes */}
        <Route path="/" element={<Home />} />
        {/* Public About page — the navbar's About link points here. */}
        <Route path="/about" element={<About />} />
              {/* New-company flow: pick a plan first, then register, then (paid plans)
                  complete the dummy payment. */}
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/register" element={<CompanyRegister />} />
              <Route path="/subscription-payment/:paymentId" element={<SubscriptionPaymentPage />} />
              {/* Legacy deep link: registration now always starts at the plans page. */}
              <Route path="/admin/register" element={<Navigate to="/plans" replace />} />
              <Route path="/admin/login" element={<CompanyLogin />} />
              <Route path="/superadmin/login" element={<SuperAdminLogin />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route path="/customer/login" element={<CustomerLogin />} />
              <Route path="/accept-vendor-invite" element={<AcceptVendorInvite />} />
              <Route path="/vendor/login" element={<VendorLogin />} />

              {/* 2. Protected Routes (Require active authentication) */}
              <Route element={<ProtectedRoute />}>
                {/* Company Admin Only — shared shell, one sidebar + header for every page */}
                <Route element={<RoleGuard allowedRole="COMPANY_ADMIN" />}>
                  <Route
                    path="/admin"
                    element={
                      <Suspense fallback={layoutFallback}>
                        <CompanyAdminLayout />
                      </Suspense>
                    }
                  >
                    <Route index element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="dashboard" element={<CompanyAdminDashboardHome />} />
                    <Route path="customers" element={<CompanyAdminCustomer />} />
                    <Route path="vendors" element={<CompanyAdminVendor />} />
                    {/* Split catalogue pages. The old combined "Products & Services"
                        route was /admin/products, which now serves the Products page,
                        so existing links to it keep working. */}
                    <Route path="products" element={<CompanyAdminProduct />} />
                    <Route path="services" element={<CompanyAdminService />} />
                    <Route path="unit-category" element={<CompanyAdminUnitCategory />} />
                    {/* Reports section. The base route no longer shows the old
                        landing page - it redirects to the Sales report.
                        ReportsLayout renders the reports sidebar once and wraps
                        all ten report pages (their route paths are unchanged).
                        An unknown reports path falls back to Sales - no loop,
                        because /admin/reports/sales matches the sales route. */}
                    <Route
                      path="reports"
                      element={
                        <Suspense fallback={layoutFallback}>
                          <ReportsLayout />
                        </Suspense>
                      }
                    >
                      <Route index element={<Navigate to="/admin/reports/sales" replace />} />
                      <Route path="sales" element={<SalesReportPage />} />
                      <Route path="purchases" element={<PurchasesReportPage />} />
                      <Route path="transactions" element={<TransactionsReportPage />} />
                      <Route path="profit-loss" element={<ProfitLossReportPage />} />
                      <Route path="product-profit" element={<SoldProductsReportPage />} />
                      <Route path="service-profit" element={<SoldServicesReportPage />} />
                      <Route path="customers" element={<CustomersReportPage />} />
                      <Route path="vendors" element={<VendorsReportPage />} />
                      <Route path="products" element={<ProductsReportPage />} />
                      <Route path="services" element={<ServicesReportPage />} />
                      <Route path="*" element={<Navigate to="/admin/reports/sales" replace />} />
                    </Route>
                    <Route path="settings" element={<CompanyAdminSetting />} />
                    <Route path="subscription" element={<CompanyAdminSubscription />} />

                    {/* Not in the sidebar, but still reachable by URL */}
                    <Route path="payments" element={<CompanyAdminPayment />} />

                    <Route path="invoices">
                      <Route index element={<InvoiceListRoute />} />
                      <Route path="new" element={<InvoiceNewRoute />} />
                      <Route path=":id" element={<InvoiceDetailRoute />} />
                      <Route path=":id/edit" element={<InvoiceEditRoute />} />
                    </Route>

                    <Route path="bills">
                      <Route index element={<BillListRoute />} />
                      <Route path="new" element={<BillNewRoute />} />
                      <Route path=":id" element={<BillDetailRoute />} />
                      <Route path=":id/edit" element={<BillEditRoute />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                  </Route>

                  {/* Where an expired or unsubscribed admin lands. Outside the
                      dashboard layout on purpose — that layout is exactly what a
                      blocked company will not be able to reach. Deliberately not
                      wrapped in any subscription check. */}
                  <Route
                    path="/admin/subscription-required"
                    element={
                      <Suspense fallback={layoutFallback}>
                        <CompanySubscriptionRequired />
                      </Suspense>
                    }
                  />
                </Route>

                {/* Super Admin Only */}
                <Route
                  element={
                    <Suspense fallback={layoutFallback}>
                      <RoleGuard allowedRole="SUPERADMIN" />
                    </Suspense>
                  }
                >
                  <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
                  <Route
                    path="/superadmin/companies/:id"
                    element={<SuperAdminCompanyDetails />}
                  />
                </Route>

                {/* Customer Only — shared dashboard shell (navbar + sidebar + content) */}
                <Route element={<RoleGuard allowedRole="CUSTOMER" />}>
                  <Route
                    path="/customer/dashboard"
                    element={
                      <Suspense fallback={layoutFallback}>
                        <CustomerLayout />
                      </Suspense>
                    }
                  >
                    {/* Base route redirects to the Purchased Products & Services
                        page. The old customer landing page component is left in
                        place on disk but is no longer routed. */}
                    <Route index element={<Navigate to="/customer/dashboard/purchased-products" replace />} />
                    <Route path="purchased-products" element={<CustomerPurchasedProducts />} />
                    <Route path="invoices" element={<CustomerInvoices />} />
                    <Route path="invoices/:id" element={<CustomerInvoiceDetails />} />
                    <Route path="products" element={<CustomerProducts />} />
                    <Route path="services" element={<CustomerServices />} />
                    <Route path="profile" element={<CustomerProfile />} />
                    <Route path="*" element={<Navigate to="/customer/dashboard/invoices" replace />} />
                  </Route>
                </Route>

              {/* Vendor Only — shared dashboard shell (navbar + sidebar + content), strictly read-only */}
              <Route element={<RoleGuard allowedRole="VENDOR" />}>
                <Route
                  path="/vendor/dashboard"
                  element={
                    <Suspense fallback={layoutFallback}>
                      <VendorLayout />
                    </Suspense>
                  }
                >
                  {/* Base route redirects to the Sold Products & Services page.
                      The old vendor landing page component is left in place on
                      disk but is no longer routed. */}
                  <Route index element={<Navigate to="/vendor/dashboard/sold-products" replace />} />
                  <Route path="sold-products" element={<VendorSoldProducts />} />
                  <Route path="bills" element={<VendorBills />} />
                  <Route path="bills/:id" element={<VendorBillDetails />} />
                  <Route path="products" element={<VendorProducts />} />
                  <Route path="services" element={<VendorServices />} />
                  <Route path="profile" element={<VendorProfile />} />
                  <Route path="*" element={<Navigate to="/vendor/dashboard/bills" replace />} />
                </Route>
              </Route>
              </Route>

              {/* 3. Fallback Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
      </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-transparent font-sans">
          <Navbar />

          <main className="flex-grow">
            <RoutesWithBoundary />
          </main>

          {/* Public footer for the marketing pages; hides itself for every
              signed-in role, so the dashboards render exactly as before. */}
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}
