import { ArrowRight, Loader2 } from "lucide-react";

/**
 * Auth screen shell shared by the MarkGo login and registration pages.
 *
 * Mirrors the Super Admin login design: split layout on desktop (gradient
 * brand panel + white form card), form card only on mobile. Presentation only
 * — it holds no data and performs no navigation of its own.
 */

/** The MarkGo logo mark + wordmark. */
export function MarkGoLogo({ className = "", onDark = false }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-control bg-[#111A3A] text-white shadow-sm">
        <svg
          viewBox="0 0 40 32"
          fill="none"
          stroke="currentColor"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            d="M4 6L11 26L18 6"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M22 6C22 6 28 6 31 11C34 16 34 21 31 26C28 26 22 26 22 26"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={`text-xl font-bold tracking-tight ${
          onDark ? "text-white" : "text-ink"
        }`}
      >
        Mark<span className={onDark ? "text-purple-200" : "text-primary-700"}>Go</span>
      </span>
    </div>
  );
}

/** Full-width primary action, matching the Super Admin login submit button. */
export function AuthSubmitButton({ loading, idleLabel, loadingLabel = "Signing in…" }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-[#111A3A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1B2550] focus:outline-none focus:ring-4 focus:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {loadingLabel}
        </>
      ) : (
        <>
          {idleLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </>
      )}
    </button>
  );
}

/**
 * Height of the whole auth screen: the viewport minus the 64px app navbar, so
 * the page body never scrolls. `dvh` tracks mobile browser chrome, which `vh`
 * does not.
 */
export default function AuthLayout({
  badge,
  badgeIcon: BadgeIcon,
  title,
  subtitle,
  headline,
  description,
  highlights = [],
  footerNote,
  children,
  footerLink,
  cardWidth = "max-w-[420px]",
  showMobileLogo = true,
}) {
  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-7xl grid-cols-1 items-center gap-6 bg-transparent px-4 pb-8 pt-6 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8 lg:px-8 lg:py-8">
      {/*
        Brand panel — desktop only.
        One fixed-height, vertically centred column with a constant gap, so a
        long form on the right can never stretch it or blow out its spacing.
        `overflow-hidden` keeps it non-scrollable; the height tiers below only
        shed copy when the content genuinely cannot fit, never on a normal
        laptop viewport.
      */}
      <section
        className="relative flex min-h-[280px] w-full flex-col justify-center gap-4 overflow-hidden rounded-frame border border-primary-100 bg-gradient-to-br from-[#12172F] via-[#26306A] to-[#4F46E5] p-6 shadow-pop sm:min-h-[320px] sm:p-8 lg:min-h-[560px] lg:gap-5"
      >
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-purple-300/20 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-pink-300/10 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative hidden shrink-0 lg:block">
          <MarkGoLogo onDark />
        </div>

        <div className="relative">
          {headline && (
            <h2 className="text-2xl font-bold leading-tight text-white [@media(max-height:820px)]:text-xl">
              {headline}
            </h2>
          )}

          {description && (
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80 [@media(max-height:560px)]:hidden">
              {description}
            </p>
          )}

          {highlights.length > 0 && (
            <ul className="mt-6 space-y-3 [@media(max-height:820px)]:mt-4 [@media(max-height:820px)]:space-y-2 [@media(max-height:460px)]:hidden">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-white/10 text-purple-200">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm text-white/90">{item.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {footerNote && (
          <p className="relative shrink-0 text-xs text-white/65 [@media(max-height:400px)]:hidden">
            {footerNote}
          </p>
        )}
      </section>

      {/* Form area — the only part that scrolls, on every screen size */}
      <section className="min-w-0 w-full">
        <div className="flex min-h-full flex-col items-center justify-center py-2 sm:px-2 lg:py-6">
          {showMobileLogo && (
            <div className="mb-6 w-full lg:hidden">
              <div className="flex justify-center">
                <MarkGoLogo />
              </div>
            </div>
          )}

          <div className={`w-full ${cardWidth}`}>
            <div className="rounded-card border border-primary-100 bg-white p-6 shadow-pop sm:p-8">
              <div className="text-center">
                {badge && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-800">
                    {BadgeIcon && <BadgeIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                    {badge}
                  </span>
                )}
                <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">
                  {title}
                </h1>
                {subtitle && <p className="mt-1.5 text-sm text-body">{subtitle}</p>}
              </div>

              {children}
            </div>

            {footerLink && <div className="mt-6 text-center">{footerLink}</div>}

            <p className="mt-6 text-center text-xs text-slate-400">
              © 2026 MarkGo. All rights reserved.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
