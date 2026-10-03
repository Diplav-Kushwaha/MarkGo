import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { BookOpenCheck, ClipboardList, Mail, Receipt } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthLayout, { AuthSubmitButton } from "../../components/auth/AuthLayout";
import AuthField, {
  AuthAlert,
  AuthPasswordField,
} from "../../components/auth/AuthField";

export default function AccountantLogin() {
  const { loginAccountantUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = location.state?.from?.pathname || "/accountant/dashboard";

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
      const res = await loginAccountantUser({
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
      badge="Accountant workspace"
      badgeIcon={BookOpenCheck}
      title="Accountant Login"
      subtitle="Sign in to manage accounts and reports"
      headline={
        <>
          Keep the books accurate,
          <br />
          every period.
        </>
      }
      description="Review ledgers, reconcile payments and prepare the numbers your clients and auditors ask for, without chasing spreadsheets."
      highlights={[
        { icon: ClipboardList, text: "Full invoice and bill ledgers for the company" },
        { icon: Receipt, text: "Reconcile outgoing payments against vendor bills" },
        { icon: BookOpenCheck, text: "Sales, expense and outstanding reports on demand" },
      ]}
      footerNote="Access is limited to the company you are assigned to."
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
          hint="The identifier of the organization you manage books for."
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
          placeholder="accountant@example.com"
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
