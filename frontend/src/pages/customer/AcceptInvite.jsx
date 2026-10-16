import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { verifyCustomerInviteToken, acceptCustomerInvite } from "../../api/customerAuthApi";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [verifying, setVerifying] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [verifyError, setVerifyError] = useState("");

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      let cancelled = false;
      Promise.resolve().then(() => {
        if (cancelled) return;
        setVerifyError("No invite token found in the URL. Please use the complete link provided to you.");
        setVerifying(false);
      });
      return () => {
        cancelled = true;
      };
    }

    const checkToken = async () => {
      try {
        setVerifying(true);
        const res = await verifyCustomerInviteToken(token);
        if (res.success && res.data) {
          setInviteData(res.data);
        } else {
          setVerifyError(res?.message || "This invitation link is invalid or has expired.");
        }
      } catch (err) {
        setVerifyError(
          err.response?.data?.message || "This invitation link is invalid or has expired."
        );
      } finally {
        setVerifying(false);
      }
    };

    checkToken();
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setSubmitError("");
  };

  const validatePasswordRules = (pass) => {
    if (pass.length < 8) return "Password must be at least 8 characters.";
    if (!/[a-z]/.test(pass)) return "Password must contain a lowercase letter.";
    if (!/[A-Z]/.test(pass)) return "Password must contain an uppercase letter.";
    if (!/\d/.test(pass)) return "Password must contain a digit.";
    if (!/[^A-Za-z0-9]/.test(pass)) return "Password must contain a special character.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    const ruleError = validatePasswordRules(formData.password);
    if (ruleError) {
      setSubmitError(ruleError);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await acceptCustomerInvite({
        token,
        password: formData.password,
      });

      if (res.success) {
        setIsSuccess(true);
      }
    } catch (err) {
      setSubmitError(
        err.response?.data?.message || "Failed to set password. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex min-h-full items-center justify-center bg-transparent p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          <p className="text-sm font-medium text-body">Verifying your invitation link...</p>
        </div>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="flex min-h-full items-center justify-center bg-transparent p-4">
        <div className="w-full max-w-md rounded-card border border-primary-100 bg-white p-8 text-center shadow-pop">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-tile bg-danger-soft text-danger">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-ink">Invalid or Expired Link</h2>
          <p className="mb-6 text-sm text-body">{verifyError}</p>
          <Link
            to="/customer/login"
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-[#111A3A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1B2550]"
          >
            Go to Customer Login
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-full items-center justify-center bg-transparent p-4">
        <div className="w-full max-w-md rounded-card border border-primary-100 bg-white p-8 text-center shadow-pop">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-tile bg-success-soft text-success">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-ink">Password Set Successfully!</h2>
          <p className="mb-6 text-sm text-body">
            Your customer account for <strong className="text-ink">{inviteData?.companyName || "the organization"}</strong> is ready. You can now log in using your phone number and password.
          </p>
          <button
            onClick={() => navigate("/customer/login", { state: { companySlug: inviteData?.companySlug, phoneNumber: inviteData?.phoneNumber } })}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-[#111A3A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1B2550]"
          >
            Proceed to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col justify-center bg-transparent px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <span className="rounded-full border border-primary-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-800">
            Customer Portal Setup
          </span>
          <h2 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">
            Set Your Password
          </h2>
          <p className="mt-2 text-sm text-body">
            Welcome to <strong className="text-ink">{inviteData?.companyName || "MarkGo"}</strong>. Complete your account to access invoices and orders.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-card border border-primary-100 bg-white px-6 py-8 shadow-pop sm:px-10">
          <div className="mb-6 space-y-1 rounded-tile border border-primary-100 bg-primary-50/60 p-3.5 text-xs text-body">
            <div className="flex justify-between">
              <span className="text-muted">Account Name:</span>
              <span className="font-semibold text-ink">{inviteData?.name || "Customer"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Phone Number:</span>
              <span className="font-mono text-ink">{inviteData?.phoneNumber}</span>
            </div>
          </div>

          {submitError && (
            <div className="mb-4 rounded-tile border border-danger-line bg-danger-soft p-3 text-xs text-red-800">
              {submitError}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-xs font-bold text-ink">
                New Password
              </label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                className="h-11 w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-sm text-ink transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20"
              />
              <p className="mt-1 text-[11px] text-muted">
                Must include upper & lowercase, a number, and a special character.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-ink">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                className="h-11 w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-sm text-ink transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-[#111A3A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1B2550] disabled:opacity-60"
            >
              {submitting ? "Saving Password..." : "Set Password & Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
