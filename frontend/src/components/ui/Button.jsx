import { forwardRef } from "react";
import { cn } from "../../lib/cn";
import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-[#111A3A] text-white shadow-sm hover:bg-[#1B2550] active:bg-[#1B2550] focus-visible:outline-primary-700",
  secondary:
    "bg-white text-ink border border-line shadow-sm hover:bg-primary-50 hover:text-ink hover:border-primary-200",
  ghost: "text-body hover:bg-primary-50 hover:text-ink",
  danger:
    "bg-danger text-white shadow-sm hover:bg-red-700 active:bg-red-800 focus-visible:outline-red-700",
  "danger-soft":
    "bg-danger-soft text-danger border border-danger-line hover:bg-red-100",
  "danger-ghost": "text-danger hover:bg-danger-soft hover:text-red-700",
  success:
    "bg-success text-white shadow-sm hover:bg-green-700 active:bg-green-800",
  link: "text-primary-600 hover:text-primary-700 hover:underline underline-offset-4 px-0",
};

const SIZES = {
  sm: "h-10 px-3 text-xs gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-sm gap-2",
  icon: "h-10 w-10 justify-center",
  "icon-sm": "h-10 w-10 justify-center",
};

const Button = forwardRef(function Button(
  {
    as: Component = "button",
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    className,
    children,
    type,
    ...props
  },
  ref
) {
  return (
    <Component
      ref={ref}
      type={Component === "button" ? type || "button" : undefined}
      disabled={Component === "button" ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-control font-semibold transition-all duration-150",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </Component>
  );
});

export default Button;
