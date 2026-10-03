import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  Hash,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { registerCompany } from "../../api/adminAuthApi";
import { getPlans } from "../../api/subscriptionPublicApi";
import { formatCurrency } from "../../lib/format";
import AuthLayout, { AuthSubmitButton } from "../../components/auth/AuthLayout";
import AuthField, {
  AuthAlert,
  AuthPasswordField,
  AuthSectionHeading,
} from "../../components/auth/AuthField";
import { billingLabel, isFreePlan } from "../../components/subscription/planHelpers";

export default function CompanyRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan");

  const [plan, setPlan] = useState(null);
  const [plansLoading, setPlansLoading] = useState(true);

  // A plan must be chosen before registering: without one, or with an unknown
  // one, the visitor goes back to the plans page.
  useEffect(() => {
    let active = true;

    if (!planId) {
      navigate("/plans", { replace: true });
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const res = await getPlans();
        if (!active) return;

        const found = (res.data?.plans || []).find((p) => p.id === planId);
        if (!found) {
          navigate("/plans", { replace: true });
        } else {
          setPlan(found);
        }
      } catch {
        if (active) {
          navigate("/plans", { replace: true });
        }
      } finally {
        if (active) setPlansLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [planId, navigate]);

  const [formData, setFormData] = useState({
    // Company Profile Fields
    companyName: "",
    companyEmail: "",
    companyAddress: "",
    gstNumber: "",
    city: "",
    country: "",
    // Owner / Admin Fields
    fullName: "",
    phoneNumber: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: null });
    }
  };

  const validatePasswordClientSide = (pw) => {
    if (pw.length < 8) return "Password must be at least 8 characters long.";
    if (!/[a-z]/.test(pw)) return "Password must include a lowercase letter.";
    if (!/[A-Z]/.test(pw)) return "Password must include an uppercase letter.";
    if (!/\d/.test(pw)) return "Password must include a digit.";
    if (!/[^A-Za-z0-9]/.test(pw)) return "Password must include a special character.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSuccessMsg("");

    const passwordError = validatePasswordClientSide(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    try {
      setLoading(true);
      // planId rides along so the backend knows which plan was chosen.
      const res = await registerCompany({ ...formData, planId });

      if (res.success) {
        // A paid plan is not usable yet: send the user to the dummy payment
        // page instead of signing them in.
        if (res.data?.requiresPayment && res.data?.payment?.id) {
          navigate(`/subscription-payment/${res.data.payment.id}`);
          return;
        }

        setSuccessMsg("Account created! Redirecting to login...");
        setTimeout(() => {
          navigate("/admin/login");
        }, 1500);
      } else {
        // The register endpoint answers 400/409/500 with { success: false },
        // which axios resolves rather than throws — without this branch a failed
        // registration looked like nothing happened.
        setError(res.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        // Backend Zod validation errors
        const mappedErrors = {};
        err.response.data.errors.forEach((item) => {
          mappedErrors[item.field] = item.message;
        });
        setFieldErrors(mappedErrors);
        setError("Please correct the errors highlighted below.");
      } else {
        setError(
          err.response?.data?.message || "Registration failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      badge="Get started"
      badgeIcon={Building2}
      title="Register your company"
      subtitle="Create your MarkGo company workspace in a couple of minutes"
      headline={
        <>
          Set up invoicing,
          <br />
          billing and books.
        </>
      }
      description="Register once and you get a workspace for customers, vendors, items, invoices, bills and reports — with your own admin login."
      highlights={[
        { icon: Building2, text: "One workspace for your whole finance team" },
        { icon: Hash, text: "GST-ready invoices with HSN and tax rates" },
        { icon: Lock, text: "Role-based access for staff and accountants" },
      ]}
      cardWidth="max-w-[680px]"
      footerLink={
        <p className="text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            to="/admin/login"
            className="font-semibold text-blue-800 hover:text-blue-700 hover:underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      }
    >
      {plansLoading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading your plan…</p>
      ) : (
        <>
      <AuthAlert message={error} />
      <AuthAlert message={successMsg} tone="success" />

      {/* Selected plan */}
      {plan && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Selected plan
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-bold text-slate-900">{plan.name}</span>
              <span className="text-sm text-slate-600">
                {isFreePlan(plan) ? "Free" : formatCurrency(plan.price)}
              </span>
              {!isFreePlan(plan) && (
                <span className="text-xs text-slate-500">{billingLabel(plan)}</span>
              )}
            </p>
          </div>
          <Link
            to="/plans"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-800 hover:text-blue-700"
          >
            Change plan
          </Link>
        </div>
      )}

      <form className="mt-6 space-y-6" onSubmit={handleSubmit} noValidate>
        {/* Section 1: Company Profile */}
        <section className="space-y-4">
          <AuthSectionHeading>Company Details</AuthSectionHeading>

          <AuthField
            id="companyName"
            name="companyName"
            type="text"
            label="Company name"
            icon={Building2}
            autoComplete="organization"
            required
            value={formData.companyName}
            onChange={handleChange}
            placeholder="Acme Technologies"
            error={fieldErrors.companyName}
            disabled={loading}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AuthField
              id="companyEmail"
              name="companyEmail"
              type="email"
              label="Company email"
              icon={Mail}
              autoComplete="email"
              required
              value={formData.companyEmail}
              onChange={handleChange}
              placeholder="contact@acme.com"
              error={fieldErrors.companyEmail}
              disabled={loading}
            />

            <AuthField
              id="gstNumber"
              name="gstNumber"
              type="text"
              label="GST number (optional)"
              icon={Hash}
              required={false}
              value={formData.gstNumber}
              onChange={handleChange}
              placeholder="22AAAAA0000A1Z5"
              error={fieldErrors.gstNumber}
              disabled={loading}
            />
          </div>

          <AuthField
            id="companyAddress"
            name="companyAddress"
            type="text"
            label="Company address"
            icon={MapPin}
            required
            value={formData.companyAddress}
            onChange={handleChange}
            placeholder="Suite 101, Tech Park"
            error={fieldErrors.companyAddress}
            disabled={loading}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AuthField
              id="city"
              name="city"
              type="text"
              label="City"
              icon={MapPin}
              required
              value={formData.city}
              onChange={handleChange}
              placeholder="Bengaluru"
              error={fieldErrors.city}
              disabled={loading}
            />

            <AuthField
              id="country"
              name="country"
              type="text"
              label="Country"
              icon={MapPin}
              required
              value={formData.country}
              onChange={handleChange}
              placeholder="India"
              error={fieldErrors.country}
              disabled={loading}
            />
          </div>
        </section>

        {/* Section 2: Administrator Profile */}
        <section className="space-y-4 border-t border-slate-200 pt-6">
          <AuthSectionHeading>Administrator Account</AuthSectionHeading>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AuthField
              id="fullName"
              name="fullName"
              type="text"
              label="Full name"
              icon={User}
              autoComplete="name"
              required
              value={formData.fullName}
              onChange={handleChange}
              placeholder="John Doe"
              error={fieldErrors.fullName}
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
              placeholder="+919876543210"
              error={fieldErrors.phoneNumber}
              disabled={loading}
            />

            <AuthField
              id="email"
              name="email"
              type="email"
              label="Admin login email"
              icon={Mail}
              autoComplete="username"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@acme.com"
              error={fieldErrors.email}
              disabled={loading}
            />

            <AuthPasswordField
              id="password"
              name="password"
              label="Password"
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              error={fieldErrors.password}
              disabled={loading}
            />
          </div>
        </section>

        <AuthSubmitButton
          loading={loading}
          idleLabel="Create Company Account"
          loadingLabel="Registering…"
        />
      </form>
        </>
      )}
    </AuthLayout>
  );
}
