/**
 * The MarkGo wordmark, extracted so the public navbar, footer and pages share
 * one copy. It is exactly the inline SVG the navbar already renders — the
 * navbar itself keeps its own inline copy and is left untouched, and this
 * component only adds a size option.
 */
export default function BrandMark({ className = "h-5 w-5", title = "MarkGo" }) {
  return (
    <svg viewBox="0 0 40 32" fill="none" stroke="currentColor" className={className} role="img" aria-label={title}>
      <path d="M4 6L11 26L18 6" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M22 6C22 6 28 6 31 11C34 16 34 21 31 26C28 26 22 26 22 26"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
