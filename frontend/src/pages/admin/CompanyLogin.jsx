import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Building2, Phone, Receipt, TrendingUp } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { validatePhone } from "../../lib/phone";
import AuthLayout, { AuthSubmitButton } from "../../components/auth/AuthLayout";
import AuthField, {
  AuthAlert,
  AuthPasswordField,
} from "../../components/auth/AuthField";

export default function CompanyLogin() {
  const { loginCompany } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = location.state?.from?.pathname || "/admin/dashboard";

  const [formData, setFormData] = useState({
    phoneNumber: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setPhoneError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setPhoneError("");

    const phoneResult = validatePhone(formData.phoneNumber);
    if (!phoneResult.valid) {
      setPhoneError(phoneResult.error);
      return;
    }

    try {
      setLoading(true);
      const res = await loginCompany({
        phoneNumber: phoneResult.normalized,
        password: formData.password,
      });

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
        <>
          <p className="text-sm text-body">
            Need a company account?{" "}
            <Link
              to="/plans"
              className="font-semibold text-primary-800 hover:text-primary-700 hover:underline underline-offset-4"
            >
              Register your company
            </Link>
          </p>
          <p className="mt-2 text-sm text-body">
            <Link
              to="/"
              className="font-semibold text-primary-800 hover:text-primary-700 hover:underline underline-offset-4"
            >
              Back to home
            </Link>
          </p>
        </>
      }
    >
      <AuthAlert message={error} />

      <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="phoneNumber"
          name="phoneNumber"
          type="tel"
          label="Phone number"
          icon={Phone}
          autoComplete="tel"
          required
          value={formData.phoneNumber}
          onChange={handleChange}
          placeholder="9876543210"
          disabled={loading}
          error={phoneError}
          hint={phoneError ? undefined : "10 digits. No spaces, dashes, or +91."}
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
