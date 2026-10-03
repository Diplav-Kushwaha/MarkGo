import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { getAccountantProfile } from "../../api/accountantAuthApi";

export default function AccountantDashboard() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await getAccountantProfile();
        if (res.success && res.data) {
          setProfile(res.data);
        }
      } catch (err) {
        console.error("Failed to load accountant profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFDFD]">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-100 px-6 sm:px-10 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-slate-800 tracking-tight">
              MARK<span className="text-[#059669]">GO</span>
            </span>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Accountant Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-gray-800">{profile?.name || user?.name || "Accountant"}</p>
              <p className="text-[11px] text-gray-400">{profile?.email || user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 sm:px-10 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {profile?.name || user?.name || "Accountant"}!
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Maintain general ledgers, accounts payable/receivable, and fiscal statements.
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Account Status</span>
            <div className="mt-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xl font-bold text-gray-900">{profile?.status || "ACTIVE"}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Certified accounting seat</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">License / Reg ID</span>
            <div className="mt-2">
              <span className="text-xl font-bold text-gray-900">{profile?.licenseNumber || "Corporate"}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Professional registration</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Experience</span>
            <div className="mt-2">
              <span className="text-xl font-bold text-emerald-600">{profile?.experience || "Active Practicing"}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Accounting seniority</p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between pb-5 border-b border-gray-100 mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Accountant Profile</h2>
              <p className="text-xs text-gray-500">Your fiscal officer profile credentials</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
              Authorized Auditor / Accountant
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-400 font-medium">Full Name</span>
              <span className="text-gray-900 font-semibold">{profile?.name || user?.name || "N/A"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-400 font-medium">Official Email</span>
              <span className="text-gray-900 font-mono text-xs">{profile?.email || user?.email || "N/A"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-400 font-medium">Phone Number</span>
              <span className="text-gray-900">{profile?.phoneNumber || "Not provided"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-400 font-medium">Email Verification</span>
              <span className="text-emerald-600 font-semibold">Yes (Verified)</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
