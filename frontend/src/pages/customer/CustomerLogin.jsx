import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ClipboardList, FileText, Mail, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthLayout, { AuthSubmitButton } from "../../components/auth/AuthLayout";
import AuthField, {
  AuthAlert,
  AuthPasswordField,
} from "../../components/auth/AuthField";

export default function CustomerLogin() {
  const { loginCust } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If redirected by protected route, go back there, else to customer dashboard
  const redirectPath = location.state?.from?.pathname || "/customer/dashboard";

  const [formData, setFormData] = useState({
    companySlug: location.state?.companySlug || "",
    email: location.state?.email || "",
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
      const res = await loginCust({
        companySlug: formData.companySlug.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      if (res.success) {
        navigate(redirectPath, { replace: true });
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Invalid credentials or inactive account."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      badge="Customer portal"
      badgeIcon={FileText}
      title="Customer Login"
      subtitle="Sign in to view your invoices and payments"
      headline={
        <>
          Every invoice and receipt,
          <br />
          always within reach.
        </>
      }
      description="Check what you have been billed, download your invoices, and keep track of the payments you have already made."
      highlights={[
        { icon: FileText, text: "View and download every invoice" },
        { icon: Wallet, text: "Confirm what is paid and what is still due" },
        { icon: ClipboardList, text: "Keep your billing details accurate" },
      ]}
      footerNote="Access is limited to the company you buy from."
      footerLink={
        <p className="text-sm text-slate-500">
          Are you a company administrator?{" "}
          <Link
            to="/admin/login"
            className="font-semibold text-blue-800 hover:text-blue-700 hover:underline underline-offset-4"
          >
            Company Admin Login
          </Link>
        </p>
      }
    >
      <AuthAlert message={error} />

      <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="companySlug"
          name="companySlug"
          type="text"
          label="Company slug / identifier"
          icon={ClipboardList}
          autoComplete="organization"
          required
          value={formData.companySlug}
          onChange={handleChange}
          placeholder="e.g. acme-corp"
          hint="The identifier of the business you are purchasing from."
          disabled={loading}
        />

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
          placeholder="you@example.com"
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
