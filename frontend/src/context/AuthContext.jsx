import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  loginCompanyAdmin as apiLoginCompany,
  logoutCompanyAdmin as apiLogoutCompany,
  getCompanyAdminProfile,
} from "../api/adminAuthApi";
import {
  loginSuperAdmin as apiLoginSuperAdmin,
  logoutSuperAdmin as apiLogoutSuperAdmin,
  getSuperAdminProfile,
} from "../api/superAdminAuthApi";
import {
  loginCustomer as apiLoginCustomer,
  logoutCustomer as apiLogoutCustomer,
  getCustomerProfile,
} from "../api/customerAuthApi";
import {
  loginVendor as apiLoginVendor,
  logoutVendor as apiLogoutVendor,
  getVendorProfile,
} from "../api/vendorAuthApi";
import {
  loginStaff as apiLoginStaff,
  logoutStaff as apiLogoutStaff,
  getStaffProfile,
} from "../api/staffAuthApi";
import {
  loginAccountant as apiLoginAccountant,
  logoutAccountant as apiLogoutAccountant,
  getAccountantProfile,
} from "../api/accountantAuthApi";
import { fetchCsrfToken } from "../api/csrfApi";
import { setAuthFailureHandler } from "../api/axiosInstance";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setCompany(null);
    setRole(null);
  }, []);

  // Hook for axiosInstance to trigger state cleanup on unrecoverable token failure
  useEffect(() => {
    setAuthFailureHandler(clearAuthState);
  }, [clearAuthState]);

  // Bootstrap session and CSRF on app load
  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Fetch CSRF token first so mutating requests have valid double-submit headers
        await fetchCsrfToken();
      } catch (err) {
        console.warn("CSRF token initialization failed:", err.message);
      }

      try {
        // Attempt restoring Company Admin session
        const companyRes = await getCompanyAdminProfile();
        if (companyRes.success && companyRes.data?.user) {
          setUser(companyRes.data.user);
          setCompany(companyRes.data.company);
          setRole(companyRes.data.user.role || "COMPANY_ADMIN");
          return;
        }
      } catch {
        // If not a company admin, attempt restoring Superadmin session
        try {
          const superAdminRes = await getSuperAdminProfile();
          if (superAdminRes.success && superAdminRes.data?.user) {
            setUser(superAdminRes.data.user);
            setRole(superAdminRes.data.user.role || "SUPERADMIN");
            setCompany(null);
            return;
          }
        } catch {
          // If neither admin, attempt restoring Customer session
          try {
            const customerRes = await getCustomerProfile();
            if (customerRes.success && customerRes.data) {
              setUser(customerRes.data);
              setRole("CUSTOMER");
              setCompany(null);
              return;
            }
          } catch {
            // If not customer, attempt restoring Vendor session
            try {
              const vendorRes = await getVendorProfile();
              if (vendorRes.success && vendorRes.data) {
                setUser(vendorRes.data);
                setRole("VENDOR");
                setCompany(null);
                return;
              }
            } catch {
              // If not vendor, attempt restoring Staff session
              try {
                const staffRes = await getStaffProfile();
                if (staffRes.success && staffRes.data) {
                  setUser(staffRes.data);
                  setRole("STAFF");
                  setCompany(null);
                  return;
                }
              } catch {
                // If not staff, attempt restoring Accountant session
                try {
                  const accountantRes = await getAccountantProfile();
                  if (accountantRes.success && accountantRes.data) {
                    setUser(accountantRes.data);
                    setRole("ACCOUNTANT");
                    setCompany(null);
                    return;
                  }
                } catch {
                  // No active session found
                  clearAuthState();
                }
              }
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [clearAuthState]);

  // Company Admin Login
  const loginCompany = async (credentials) => {
    const res = await apiLoginCompany(credentials);
    if (res.success && res.data) {
      setUser(res.data.user);
      setCompany(res.data.company);
      setRole(res.data.user.role || "COMPANY_ADMIN");
    }
    return res;
  };

  // Super Admin Login
  const loginSuper = async (credentials) => {
    const res = await apiLoginSuperAdmin(credentials);
    if (res.success && res.data) {
      setUser(res.data.user);
      setCompany(null);
      setRole(res.data.user.role || "SUPERADMIN");
    }
    return res;
  };

  // Customer Login
  const loginCust = async (credentials) => {
    const res = await apiLoginCustomer(credentials);
    if (res.success && res.data?.customer) {
      setUser(res.data.customer);
      setCompany(null);
      setRole("CUSTOMER");
    }
    return res;
  };

  // Vendor Login
  const loginVend = async (credentials) => {
    const res = await apiLoginVendor(credentials);
    if (res.success && res.data?.vendor) {
      setUser(res.data.vendor);
      setCompany(null);
      setRole("VENDOR");
    }
    return res;
  };

  // Staff Login
  const loginStaffUser = async (credentials) => {
    const res = await apiLoginStaff(credentials);
    if (res.success && res.data?.staff) {
      setUser(res.data.staff);
      setCompany(null);
      setRole("STAFF");
    }
    return res;
  };

  // Accountant Login
  const loginAccountantUser = async (credentials) => {
    const res = await apiLoginAccountant(credentials);
    if (res.success && res.data?.accountant) {
      setUser(res.data.accountant);
      setCompany(null);
      setRole("ACCOUNTANT");
    }
    return res;
  };

  // Logout (handles Superadmin, Company Admin, Customer, Vendor, Staff, and Accountant, clears state, and fetches a fresh CSRF token)
  const logout = async () => {
    try {
      if (role === "SUPERADMIN") {
        await apiLogoutSuperAdmin();
      } else if (role === "CUSTOMER") {
        await apiLogoutCustomer();
      } else if (role === "VENDOR") {
        await apiLogoutVendor();
      } else if (role === "STAFF") {
        await apiLogoutStaff();
      } else if (role === "ACCOUNTANT") {
        await apiLogoutAccountant();
      } else {
        await apiLogoutCompany();
      }
    } catch (err) {
      console.warn("Server logout error:", err.message);
    } finally {
      clearAuthState();
      try {
        await fetchCsrfToken();
      } catch (csrfErr) {
        console.warn("Failed to renew CSRF token post-logout:", csrfErr.message);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        role,
        loading,
        loginCompany,
        loginSuper,
        loginCust,
        loginVend,
        loginStaffUser,
        loginAccountantUser,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};