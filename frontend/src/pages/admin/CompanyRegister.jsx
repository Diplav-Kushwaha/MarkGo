import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  Hash,
  Lock,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { registerCompany } from "../../api/adminAuthApi";
import { getPlans } from "../../api/subscriptionPublicApi";
import { formatCurrency } from "../../lib/format";
import { validatePhone } from "../../lib/phone";
import AuthLayout, { AuthSubmitButton } from "../../components/auth/AuthLayout";
import AuthField, {
  AuthAlert,
  AuthPasswordField,
  AuthSectionHeading,
} from "../../components/auth/AuthField";
import { billingLabel, isFreePlan } from "../../components/subscription/planHelpers";

const requiredLabel = (text) => (
  <span>
    {text}
    <span aria-hidden="true" className="ml-0.5 text-red-500">
      *
    </span>
  </span>
);

export default function CompanyRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan");

  const [plan, setPlan] = useState(null);
  const [plansLoading, setPlansLoading] = useState(true);

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
    companyName: "",
    companyAddress: "",
    state: "",
    fullName: "",
    phoneNumber: "",
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

    const phoneResult = validatePhone(formData.phoneNumber);
    if (!phoneResult.valid) {
      setFieldErrors({ phoneNumber: phoneResult.error });
      setError("Please correct the errors highlighted below.");
      return;
    }

    try {
      setLoading(true);
      const res = await registerCompany({
        ...formData,
        phoneNumber: phoneResult.normalized,
        planId,
      });

      if (res.success) {
        if (res.data?.requiresPayment && res.data?.payment?.id) {
          navigate(`/subscription-payment/${res.data.payment.id}`);
          return;
        }

        setSuccessMsg("Account created! Redirecting to login...");
        setTimeout(() => {
          navigate("/admin/login");
        }, 1500);
      } else {
        setError(res.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      if (err.response?.data?.errors) {
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
        { icon: Lock, text: "Role-based access for your team" },
      ]}
      cardWidth="max-w-[680px]"
      footerLink={
        <>
          <p className="text-sm text-body">
            Already have an account?{" "}
            <Link
              to="/admin/login"
              className="font-semibold text-primary-800 hover:text-primary-700 hover:underline underline-offset-4"
            >
              Sign in
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
      {plansLoading ? (
        <p className="py-10 text-center text-sm text-body">Loading your plan…</p>
      ) : (
        <>
        <AuthAlert message={error} />
        <AuthAlert message={successMsg} tone="success" />

        {plan && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-tile border border-primary-100 bg-primary-50/70 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Selected plan
              </p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-bold text-ink">{plan.name}</span>
                <span className="text-sm text-body">
                  {isFreePlan(plan) ? "Free" : formatCurrency(plan.price)}
                </span>
                {!isFreePlan(plan) && (
                  <span className="text-xs text-muted">{billingLabel(plan)}</span>
                )}
              </p>
            </div>
            <Link
              to="/plans"
              className="min-h-10 rounded-control border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
            >
              Change plan
            </Link>
          </div>
        )}

        <form className="mt-6 space-y-6" onSubmit={handleSubmit} noValidate>
          <section className="space-y-4">
            <AuthSectionHeading>Company details</AuthSectionHeading>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AuthField
                id="companyName"
                name="companyName"
                type="text"
                label={requiredLabel("Company name")}
                icon={Building2}
                autoComplete="organization"
                required
                value={formData.companyName}
                onChange={handleChange}
                placeholder="Acme Technologies"
                error={fieldErrors.companyName}
                disabled={loading}
              />

              <AuthField
                id="companyAddress"
                name="companyAddress"
                type="text"
                label={requiredLabel("Company address")}
                icon={MapPin}
                required
                value={formData.companyAddress}
                onChange={handleChange}
                placeholder="Suite 101, Tech Park"
                error={fieldErrors.companyAddress}
                disabled={loading}
                className="sm:col-span-2"
              />

              <AuthField
                id="state"
                name="state"
                type="text"
                label={requiredLabel("State")}
                icon={MapPin}
                required
                value={formData.state}
                onChange={handleChange}
                placeholder="Karnataka"
                error={fieldErrors.state}
                disabled={loading}
              />
            </div>
          </section>

          <section className="space-y-4 border-t border-line pt-6">
            <AuthSectionHeading>Admin account</AuthSectionHeading>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AuthField
                id="fullName"
                name="fullName"
                type="text"
                label={requiredLabel("Full name")}
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
                label={requiredLabel("Phone number")}
                icon={Phone}
                autoComplete="tel"
                required
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="9876543210"
                error={fieldErrors.phoneNumber}
                disabled={loading}
                hint="10 digits. Used for login."
              />

              <AuthPasswordField
                id="password"
                name="password"
                label={requiredLabel("Password")}
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
