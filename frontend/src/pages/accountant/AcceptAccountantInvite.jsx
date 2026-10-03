import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { verifyAccountantInviteToken, acceptAccountantInvite } from "../../api/accountantAuthApi";

export default function AcceptAccountantInvite() {
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
      setVerifyError("No invite token found in the URL. Please use the complete link provided to you.");
      setVerifying(false);
      return;
    }

    const checkToken = async () => {
      try {
        setVerifying(true);
        const res = await verifyAccountantInviteToken(token);
        if (res.success && res.data) {
          setInviteData(res.data);
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
      const res = await acceptAccountantInvite({
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
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-gray-50 p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-600">Verifying your accountant invitation link...</p>
        </div>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h2>
          <p className="text-sm text-gray-600 mb-6">{verifyError}</p>
          <Link
            to="/accountant/login"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition"
          >
            Go to Accountant Login
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Password Set Successfully!</h2>
          <p className="text-sm text-gray-600 mb-6">
            Your accountant account for <strong className="text-gray-800">{inviteData?.companyName || "the organization"}</strong> is ready. You can now log in using your email and password.
          </p>
          <button
            onClick={() => navigate("/accountant/login", { state: { companySlug: inviteData?.companySlug, email: inviteData?.email } })}
            className="w-full inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm"
          >
            Proceed to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            Accountant Portal Setup
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-gray-900">
            Set Your Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Welcome to <strong className="text-gray-900">{inviteData?.companyName || "MarkGo"}</strong>. Complete your account to access company books, ledgers, and financial reports.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow sm:rounded-xl sm:px-10 border border-gray-100">
          <div className="mb-6 p-3.5 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Accountant Name:</span>
              <span className="font-semibold text-gray-800">{inviteData?.name || "Accountant"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Account Email:</span>
              <span className="font-mono text-gray-800">{inviteData?.email}</span>
            </div>
          </div>

          {submitError && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 text-xs text-red-700 rounded-r">
              {submitError}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Must include upper & lowercase, a number, and a special character.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-60 shadow-sm shadow-emerald-500/20"
            >
              {submitting ? "Saving Password..." : "Set Password & Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
