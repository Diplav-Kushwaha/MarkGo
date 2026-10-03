import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./guards/ProtectedRoute";
import Navbar from "./components/Navbar";
import RoleGuard from "./guards/RoleGuard";
import Home from "./pages/Home";
import CompanyRegister from "./pages/admin/CompanyRegister";
import PlansPage from "./pages/subscription/PlansPage";
import SubscriptionPaymentPage from "./pages/subscription/SubscriptionPaymentPage";
import CompanyLogin from "./pages/admin/CompanyLogin";
import SuperAdminLogin from "./pages/superadmin/SuperAdminLogin";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminCompanyDetails from "./pages/superadmin/SuperAdminCompanyDetails";
import AcceptInvite from "./pages/customer/AcceptInvite";
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import AcceptVendorInvite from "./pages/vendor/AcceptVendorInvite";
import VendorLogin from "./pages/vendor/VendorLogin";
import VendorDashboard from "./pages/vendor/VendorDashboard";
import AcceptStaffInvite from "./pages/staff/AcceptStaffInvite";
import StaffLogin from "./pages/staff/StaffLogin";
import StaffDashboard from "./pages/staff/StaffDashboard";
import AcceptAccountantInvite from "./pages/accountant/AcceptAccountantInvite";
import AccountantLogin from "./pages/accountant/AccountantLogin";
import AccountantDashboard from "./pages/accountant/AccountantDashboard";

import CompanyAdminLayout from "./components/admin/CompanyAdminLayout";
import CompanyAdminDashboardHome from "./pages/admin/CompanyAdminDashboardHome";
import CompanyAdminCustomer from "./pages/admin/CompanyAdminCustomer";
import CompanyAdminVendor from "./pages/admin/CompanyAdminVendor";
import CompanyAdminTeamPage from "./pages/admin/CompanyAdminTeamPage";
import CompanyAdminProductService from "./pages/admin/CompanyAdminProductService";
import CompanyAdminPayment from "./pages/admin/CompanyAdminPayment";
import CompanyAdminReport from "./pages/admin/CompanyAdminReport";
import CompanyAdminSetting from "./pages/admin/CompanyAdminSetting";
import CompanyAdminSubscription from "./pages/admin/CompanyAdminSubscription";
import CompanySubscriptionRequired from "./pages/admin/CompanySubscriptionRequired";
import {
  InvoiceListRoute,
  InvoiceNewRoute,
  InvoiceEditRoute,
  InvoiceDetailRoute,
} from "./pages/admin/InvoiceRoutes";
import { BillListRoute, BillNewRoute, BillEditRoute, BillDetailRoute } from "./pages/admin/BillRoutes";
import ErrorBoundary from "./components/ErrorBoundary";

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
              <Route path="/accept-staff-invite" element={<AcceptStaffInvite />} />
              <Route path="/staff/login" element={<StaffLogin />} />
              <Route path="/accept-accountant-invite" element={<AcceptAccountantInvite />} />
              <Route path="/accountant/login" element={<AccountantLogin />} />

              {/* 2. Protected Routes (Require active authentication) */}
              <Route element={<ProtectedRoute />}>
                {/* Company Admin Only — shared shell, one sidebar + header for every page */}
                <Route element={<RoleGuard allowedRole="COMPANY_ADMIN" />}>
                  <Route path="/admin" element={<CompanyAdminLayout />}>
                    <Route index element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="dashboard" element={<CompanyAdminDashboardHome />} />
                    <Route path="customers" element={<CompanyAdminCustomer />} />
                    <Route path="vendors" element={<CompanyAdminVendor />} />
                    <Route path="team" element={<CompanyAdminTeamPage />} />
                    <Route path="products" element={<CompanyAdminProductService />} />
                    <Route path="reports" element={<CompanyAdminReport />} />
                    <Route path="settings" element={<CompanyAdminSetting />} />
                    <Route path="subscription" element={<CompanyAdminSubscription />} />

                    {/* Accountants now live on the Team page; keep old links working */}
                    <Route path="accountants" element={<Navigate to="/admin/team?role=accountant" replace />} />

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
                    element={<CompanySubscriptionRequired />}
                  />
                </Route>

                {/* Super Admin Only */}
                <Route element={<RoleGuard allowedRole="SUPERADMIN" />}>
                  <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
                  <Route
                    path="/superadmin/companies/:id"
                    element={<SuperAdminCompanyDetails />}
                  />
                </Route>

                {/* Customer Only */}
                <Route element={<RoleGuard allowedRole="CUSTOMER" />}>
                  <Route path="/customer/dashboard" element={<CustomerDashboard />} />
                </Route>

                {/* Vendor Only */}
                <Route element={<RoleGuard allowedRole="VENDOR" />}>
                  <Route path="/vendor/dashboard" element={<VendorDashboard />} />
                </Route>

                {/* Staff Only */}
                <Route element={<RoleGuard allowedRole="STAFF" />}>
                  <Route path="/staff/dashboard" element={<StaffDashboard />} />
                </Route>

                {/* Accountant Only */}
                <Route element={<RoleGuard allowedRole="ACCOUNTANT" />}>
                  <Route path="/accountant/dashboard" element={<AccountantDashboard />} />
                </Route>
              </Route>

              {/* 3. Fallback Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
      </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
          <Navbar />

          <main className="flex-grow">
            <RoutesWithBoundary />
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}
