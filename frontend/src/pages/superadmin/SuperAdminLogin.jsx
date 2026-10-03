import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

/* ------------------------------------------------------------------ *
 * Shared class strings, local to this page so nothing global is edited.
 * ------------------------------------------------------------------ */
const FIELD_LABEL = "block text-sm font-medium text-slate-700";
const FIELD_CONTROL =
  "block w-full rounded-xl border bg-white py-2.5 pl-11 pr-11 text-sm text-slate-900 shadow-sm transition " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50";

const controlClass = (invalid) =>
  [
    FIELD_CONTROL,
    invalid
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-slate-300 focus:border-blue-800 focus:ring-blue-100",
  ].join(" ");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function MarkGoLogo({ className = "", textClassName = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-white shadow-sm">
        <svg
          viewBox="0 0 40 32"
          fill="none"
          stroke="currentColor"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            d="M4 6L11 26L18 6"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M22 6C22 6 28 6 31 11C34 16 34 21 31 26C28 26 22 26 22 26"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={`text-xl font-bold tracking-tight text-slate-900 ${textClassName}`}
      >
        Mark<span className="text-blue-800">Go</span>
      </span>
    </div>
  );
}

export default function SuperAdminLogin() {
  const { loginSuper } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = location.state?.from?.pathname || "/superadmin/dashboard";

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Client-side only, never sent to the API — the request body stays
  // exactly { email, password }.
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setFieldErrors((previous) => ({ ...previous, [e.target.name]: "" }));
  };

  const validate = () => {
    const found = {};

    const email = formData.email.trim();
    if (!email) found.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(email)) found.email = "Enter a valid email address.";

    if (!formData.password) found.password = "Password is required.";

    return found;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const found = validate();
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      setLoading(true);
      const res = await loginSuper(formData);

      if (res.success) {
        navigate(redirectPath, { replace: true });
      } else if (res.message) {
        setError(res.message);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Invalid superadmin credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const platformHighlights = [
    { icon: Users, text: "All registered companies, in one directory" },
    { icon: TrendingUp, text: "Platform-wide revenue and subscription health" },
    { icon: ShieldCheck, text: "Suspend, reactivate and audit tenant access" },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col lg:flex-row">
        {/* Brand panel — desktop only */}
        <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 p-12 lg:flex">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-400/10 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-blue-500/10 blur-2xl"
            aria-hidden="true"
          />

          <div className="relative">
            <MarkGoLogo textClassName="text-white [&>span]:text-teal-300" />
          </div>

          <div className="relative">
            <h2 className="text-3xl font-bold leading-tight text-white">
              Manage every company&apos;s
              <br />
              finances in one place.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-blue-100/80">
              The MarkGo control plane for overseeing tenants, plans and
              platform-wide operations with the controls your finance team
              expects.
            </p>

            <ul className="mt-10 space-y-4">
              {platformHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-teal-300">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm text-blue-50/90">{item.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="relative text-xs text-blue-200/60">
            Authorized personnel only. All access is logged.
          </p>
        </section>

        {/* Form panel */}
        <section className="flex w-full flex-col items-center justify-center px-4 py-10 sm:px-8 lg:w-1/2 lg:py-12">
          {/* Mobile-only brand */}
          <div className="mb-6 lg:hidden">
            <MarkGoLogo className="justify-center" />
          </div>

          <div className="w-full max-w-[420px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
              <div className="text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-800">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Restricted area
                </span>
                <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                  Super Admin Login
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">
                  Sign in to manage the platform
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <form
                className="mt-6 space-y-5"
                onSubmit={handleSubmit}
                noValidate
              >
                {/* Email */}
                <div>
                  <label htmlFor="email" className={FIELD_LABEL}>
                    Email address
                  </label>
                  <div className="relative mt-1.5">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="superadmin@markgo.com"
                      aria-invalid={fieldErrors.email ? true : undefined}
                      aria-describedby={
                        fieldErrors.email ? "email-error" : undefined
                      }
                      disabled={loading}
                      className={controlClass(fieldErrors.email)}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p
                      id="email-error"
                      className="mt-1.5 text-xs text-red-600"
                    >
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="password" className={FIELD_LABEL}>
                      Password
                    </label>
                    {/* No forgot-password route exists in this app yet. */}
                    <span
                      className="cursor-not-allowed text-xs font-medium text-slate-400"
                      title="Password reset is not available yet"
                      aria-disabled="true"
                    >
                      Forgot password?
                    </span>
                  </div>
                  <div className="relative mt-1.5">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      aria-invalid={fieldErrors.password ? true : undefined}
                      aria-describedby={
                        fieldErrors.password ? "password-error" : undefined
                      }
                      disabled={loading}
                      className={controlClass(fieldErrors.password)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      disabled={loading}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p
                      id="password-error"
                      className="mt-1.5 text-xs text-red-600"
                    >
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {/* Remember me */}
                <div className="flex items-center">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="h-4 w-4 rounded border-slate-300 text-blue-800 transition focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
                  />
                  <label
                    htmlFor="rememberMe"
                    className="ml-2 select-none text-sm text-slate-600"
                  >
                    Remember me
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              © 2026 MarkGo. All rights reserved.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
