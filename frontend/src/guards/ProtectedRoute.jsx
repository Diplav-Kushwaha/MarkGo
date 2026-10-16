import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/LoadingScreen";

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    // Determine the login fallback based on the attempted path
    let fallbackPath = "/admin/login";
    if (location.pathname.startsWith("/superadmin")) {
      fallbackPath = "/superadmin/login";
    } else if (location.pathname.startsWith("/customer")) {
      fallbackPath = "/customer/login";
    } else if (location.pathname.startsWith("/vendor")) {
      fallbackPath = "/vendor/login";
    }

    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
