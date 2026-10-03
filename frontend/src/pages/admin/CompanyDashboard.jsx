import { Navigate } from "react-router-dom";

/**
 * The admin shell (sidebar + header) now lives in CompanyAdminLayout and is
 * mounted once by the router. This component only keeps the legacy /admin
 * entry point redirecting to the dashboard.
 */
export default function CompanyDashboard() {
  return <Navigate to="/admin/dashboard" replace />;
}
