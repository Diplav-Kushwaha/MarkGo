import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ClipboardList, HandCoins, Phone, Truck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { validatePhone } from "../../lib/phone";
import AuthLayout, { AuthSubmitButton } from "../../components/auth/AuthLayout";
import AuthField, {
  AuthAlert,
  AuthPasswordField,
} from "../../components/auth/AuthField";

export default function VendorLogin() {
  const { loginVend } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = location.state?.from?.pathname || "/vendor/dashboard/sold-products";

  const [formData, setFormData] = useState({
    companySlug: location.state?.companySlug || "",
    phoneNumber: location.state?.phoneNumber || "",
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
      const res = await loginVend({
        companySlug: formData.companySlug.trim().toLowerCase(),
        phoneNumber: phoneResult.normalized,
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
      badge="Vendor workspace"
      badgeIcon={Truck}
      title="Vendor Login"
      subtitle="Sign in to view your bills and payments"
      headline={
        <>
          Get paid faster with
          <br />
          less chasing.
        </>
      }
      description="See every bill raised against your business, what has been settled, and what is still outstanding — with the payment history to back it up."
      highlights={[
        { icon: HandCoins, text: "Track what you are owed and what is overdue" },
        { icon: ClipboardList, text: "Full history of bills and payments made" },
        { icon: Truck, text: "Keep your supplier profile and terms up to date" },
      ]}
      footerNote="Access is limited to the company you supply to."
      footerLink={
        <>
          <p className="text-sm text-body">
            Are you a company administrator?{" "}
            <Link
              to="/admin/login"
              className="font-semibold text-primary-800 hover:text-primary-700 hover:underline underline-offset-4"
            >
              Company Admin Login
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
          hint="The identifier of the business you supply to."
          disabled={loading}
        />

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
