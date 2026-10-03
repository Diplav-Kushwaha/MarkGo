import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { isAuthenticated, role } = useAuth();
  const dashboardPath =
    role === "SUPERADMIN" ? "/superadmin/dashboard" : "/admin/dashboard";

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex flex-col justify-center items-center overflow-hidden bg-[#fafafa]">
      {/* Subtle diamond / dot grid pattern matching screenshot background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(#94a3b8 1.2px, transparent 1.2px)`,
          backgroundSize: "28px 28px",
          backgroundPosition: "0 0",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        
        {/* Top Announcement Pill / Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200/80 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] mb-8 transition-transform hover:scale-[1.02]">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </span>
          <span className="text-xs sm:text-sm font-semibold text-gray-800">
            MarkGo SaaS
          </span>
          <span className="text-gray-300">|</span>
          <Link
            to="/announcements"
            className="text-xs sm:text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group"
          >
            <span>See what's new</span>
            <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </Link>
        </div>

        {/* Hero Main Heading */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-[#1e293b] tracking-tight leading-[1.12]">
          The Accounting And Billing SaaS <br className="hidden sm:inline" />
          <span className="text-emerald-600 inline-block mt-1">Platform Built For Scale</span>
        </h1>

        {/* Subtitle / Description */}
        <p className="mt-6 sm:mt-7 text-sm sm:text-base md:text-lg text-gray-500 max-w-3xl mx-auto leading-relaxed font-normal">
          MarkGo SaaS is an accounting and billing platform that helps SaaS businesses handle
          invoicing, manage inventory, handle taxation, and give each tenant a clean financial dashboard.
        </p>

        {/* CTA Buttons Section */}
        <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 relative">
          
          {/* Decorative burst on top-left of primary button */}
          <div className="absolute -top-6 left-1/4 sm:left-[22%] hidden md:block select-none pointer-events-none opacity-80">
            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364-6.364l-2.121 2.121M7.757 16.243l-2.121 2.121m12.728 0l-2.121-2.121M7.757 7.757L5.636 5.636" />
            </svg>
          </div>

          {!isAuthenticated ? (
            <>
              {/* Register Company Button (Styled like the primary orange CTA) */}
              <Link
                to="/plans"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full text-base font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
                Register Company
              </Link>

              {/* Login Button (Styled like the secondary emerald CTA) */}
              <Link
                to="/admin/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full text-base font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                Login
              </Link>
            </>
          ) : (
            <Link
              to={dashboardPath}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-9 py-3.5 rounded-full text-base font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            >
              Go to Dashboard &rarr;
            </Link>
          )}

          {/* Decorative "try it for free" doodle text on the right */}
          <div className="hidden lg:block absolute -right-6 top-0 select-none pointer-events-none text-left transform rotate-[-6deg]">
            <span className="font-serif italic text-2xl font-bold text-gray-800 tracking-wide block leading-tight">
              try it <br /> for free
            </span>
            <svg className="w-10 h-10 text-gray-700 -ml-2 -mt-1" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 40 40">
              <path strokeLinecap="round" strokeLinejoin="round" d="M25 8 C28 16, 20 22, 10 26 M10 26 L16 26 M10 26 L12 21" />
            </svg>
          </div>
        </div>

      </div>
    </div>
  );
}