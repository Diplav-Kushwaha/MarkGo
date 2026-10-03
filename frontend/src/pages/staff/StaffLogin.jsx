import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Boxes, ClipboardList, Mail, PackageSearch } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthLayout, { AuthSubmitButton } from "../../components/auth/AuthLayout";
import AuthField, {
  AuthAlert,
  AuthPasswordField,
} from "../../components/auth/AuthField";

export default function StaffLogin() {
  const { loginStaffUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = location.state?.from?.pathname || "/staff/dashboard";

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
      const res = await loginStaffUser({
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
      badge="Staff workspace"
      badgeIcon={Boxes}
      title="Staff Login"
      subtitle="Sign in to access your workspace"
      headline={
        <>
          Day-to-day operations,
          <br />
          without the paperwork.
        </>
      }
      description="Your working view of the company: maintain customer and vendor records, keep stock accurate and keep day-to-day records tidy."
      highlights={[
        { icon: PackageSearch, text: "Maintain products, services and stock levels" },
        { icon: ClipboardList, text: "Update customers, vendors and operational records" },
        { icon: Boxes, text: "Always working from the same shared data" },
      ]}
      footerNote="Access is limited to the company you are assigned to."
      footerLink={
        <p className="text-sm text-slate-500">
          Are you an administrator?{" "}
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
          hint="The identifier of the organization you work for."
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
          placeholder="staff@example.com"
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
