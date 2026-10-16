import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthLayout, { AuthSubmitButton } from "../../components/auth/AuthLayout";
import AuthField, {
  AuthAlert,
  AuthPasswordField,
} from "../../components/auth/AuthField";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    <AuthLayout
      badge="Restricted area"
      badgeIcon={ShieldCheck}
      title="Super Admin Login"
      subtitle="Sign in to manage the platform"
      headline={
        <>
          Manage every company&apos;s
          <br />
          finances in one place.
        </>
      }
      description="The MarkGo control plane for overseeing tenants, plans and platform-wide operations with the controls your finance team expects."
      highlights={platformHighlights}
      footerNote="Authorized personnel only. All access is logged."
      footerLink={
        <p className="text-sm text-body">
          <Link
            to="/"
            className="font-semibold text-primary-800 hover:text-primary-700 hover:underline underline-offset-4"
          >
            Back to home
          </Link>
        </p>
      }
    >
      <AuthAlert message={error} />

      <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="email"
          name="email"
          type="email"
          label="Email address"
          icon={Mail}
          autoComplete="username"
          required
          value={formData.email}
          onChange={handleChange}
          placeholder="superadmin@markgo.com"
          error={fieldErrors.email}
          disabled={loading}
        />

        <AuthPasswordField
          id="password"
          name="password"
          label="Password"
          required
          value={formData.password}
          onChange={handleChange}
          disabled={loading}
          error={fieldErrors.password}
          labelAction={
            <span
              className="cursor-not-allowed text-xs font-medium text-slate-400"
              title="Password reset is not available yet"
              aria-disabled="true"
            >
              Forgot password?
            </span>
          }
        />

        {/* Remember me */}
        <div className="flex items-center">
          <input
            id="rememberMe"
            name="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={loading}
            className="h-4 w-4 rounded border-line text-primary-700 transition focus:ring-2 focus:ring-primary-200 disabled:opacity-50"
          />
          <label
            htmlFor="rememberMe"
            className="ml-2 select-none text-sm text-body"
          >
            Remember me
          </label>
        </div>

        <AuthSubmitButton
          loading={loading}
          idleLabel="Sign In"
          loadingLabel="Signing in…"
        />
      </form>
    </AuthLayout>
  );
}
