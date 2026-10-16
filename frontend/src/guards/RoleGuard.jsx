import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/LoadingScreen";

export default function RoleGuard({ allowedRole }) {
  const { role, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // Prevent cross-role access (e.g. COMPANY_ADMIN visiting superadmin dashboard)
  if (role !== allowedRole) {
    let redirectPath = "/admin/dashboard";
    if (role === "SUPERADMIN") {
      redirectPath = "/superadmin/dashboard";
    } else if (role === "CUSTOMER") {
      redirectPath = "/customer/dashboard";
    } else if (role === "VENDOR") {
      redirectPath = "/vendor/dashboard";
    }
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
}
