import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Building2, Mail, Receipt, TrendingUp } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthLayout, { AuthSubmitButton } from "../../components/auth/AuthLayout";
import AuthField, {
  AuthAlert,
  AuthPasswordField,
} from "../../components/auth/AuthField";

export default function CompanyLogin() {
  const { loginCompany } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If the user was redirected here by ProtectedRoute, send them back there; otherwise go to dashboard
  const redirectPath = location.state?.from?.pathname || "/admin/dashboard";

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      const res = await loginCompany(formData);

      if (res.success) {
        navigate(redirectPath, { replace: true });
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Invalid credentials. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      badge="Company workspace"
      badgeIcon={Building2}
      title="Company Admin Login"
      subtitle="Sign in to manage your company"
      headline={
        <>
          Run invoicing, bills and
          <br />
          reporting in one place.
        </>
      }
      description="Your MarkGo workspace brings customers, vendors, taxes and cash flow together so your finance team can close the books faster."
      highlights={[
        { icon: Receipt, text: "Create invoices and track every payment" },
        { icon: TrendingUp, text: "Live profit and loss, receivables and payables" },
        { icon: Building2, text: "Your customers, vendors and team in one ledger" },
      ]}
      footerNote="All activity in your workspace is recorded against your company account."
      footerLink={
        <p className="text-sm text-slate-500">
          Need a company account?{" "}
          <Link
            to="/plans"
            className="font-semibold text-blue-800 hover:text-blue-700 hover:underline underline-offset-4"
          >
            Register your company
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
          placeholder="admin@company.com"
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
          labelAction={
            /* No forgot-password route exists in this app yet. */
            <span
              className="cursor-not-allowed text-xs font-medium text-slate-400"
              title="Password reset is not available yet"
              aria-disabled="true"
            >
              Forgot password?
            </span>
          }
        />

        <AuthSubmitButton
          loading={loading}
          idleLabel="Sign In"
          loadingLabel="Signing in…"
        />
      </form>
    </AuthLayout>
  );
}
