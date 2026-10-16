import axios from "axios";

const axiosInstance = axios.create({
  // Point to backend port (default 5000 from index.js)
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Optional hook for AuthContext to register itself so it can clear local
 * auth state when a refresh ultimately fails (i.e. the session is really
 * gone, not just the access token). Kept as a simple module-level callback
 * rather than pulling in a full event bus for one use case.
 */
let authFailureHandler = null;
let csrfTokenValue = null;
export function setAuthFailureHandler(handler) {
  authFailureHandler = handler;
}

// ---- Request interceptor: attach CSRF token on every mutating request ----
// The backend's double-submit CSRF check compares this header against the
// `csrfToken` cookie set by GET /api/csrf-token. GET/HEAD/OPTIONS are
// exempt on the backend too, so there's nothing to attach for those.
axiosInstance.interceptors.request.use((config) => {
  const method = (config.method || "get").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = csrfTokenValue || getCookie("csrfToken");
    if (csrfToken) {
      config.headers["x-csrf-token"] = csrfToken;
    }
  }
  return config;
});

// ---- Response interceptor: silent refresh on an expired access token ----
// Multiple requests can fail with TOKEN_EXPIRED at nearly the same time
// (e.g. a page firing several API calls on mount); this queue makes sure
// only one refresh call actually goes out, and every other failed request
// waits for it and retries once it resolves.
let isRefreshing = false;
let pendingQueue = [];

function flushQueue(error) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()));
  pendingQueue = [];
}

axiosInstance.interceptors.response.use(
  (response) => {
    if (response.config?.url?.includes("/api/csrf-token")) {
      csrfTokenValue = response.data?.csrfToken || null;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const isCompanyAdminApiCall = originalRequest?.url?.includes("/api/admin/");
    const isSubscriptionApiCall = originalRequest?.url?.includes("/api/admin/subscription");

    if (
      status === 403 &&
      code === "SUBSCRIPTION_REQUIRED" &&
      isCompanyAdminApiCall &&
      !isSubscriptionApiCall &&
      window.location.pathname !== "/admin/subscription-required"
    ) {
      window.location.assign("/admin/subscription-required");
    }

    const isRefreshCall =
      originalRequest?.url?.includes("/api/auth/refresh") ||
      originalRequest?.url?.includes("/api/customer/refresh") ||
      originalRequest?.url?.includes("/api/vendor/refresh");

    if (status === 401 && code === "TOKEN_EXPIRED" && !originalRequest._retry && !isRefreshCall) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then(() => axiosInstance(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const isCustomerRequest = originalRequest?.url?.includes("/api/customer");
        const isVendorRequest = originalRequest?.url?.includes("/api/vendor");
        let refreshEndpoint = "/api/auth/refresh";
        if (isCustomerRequest) {
          refreshEndpoint = "/api/customer/refresh";
        } else if (isVendorRequest) {
          refreshEndpoint = "/api/vendor/refresh";
        }

        await axiosInstance.post(refreshEndpoint);
        flushQueue(null);
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError);
        // Refresh token is invalid/expired/revoked too — the session is
        // genuinely over. Let the app clear its auth state and redirect.
        if (authFailureHandler) authFailureHandler();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
