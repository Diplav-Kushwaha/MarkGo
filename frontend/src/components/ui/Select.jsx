import { forwardRef, useId } from "react";
import { cn } from "../../lib/cn";
import { ChevronDown } from "lucide-react";
import { Field } from "./Input";

const Select = forwardRef(function Select(
  {
    label,
    error,
    hint,
    required,
    options = [],
    placeholder,
    size = "md",
    className,
    containerClassName,
    id,
    children,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const selectId = id || props.name || generatedId;
  // Exposed as a size rather than a className override: Tailwind emits `h-9`
  // after `h-8`, so overriding the height through className alone would lose.
  const controlSize = size === "sm" ? "h-8 text-xs" : "h-9";

  return (
    <Field label={label} htmlFor={selectId} required={required} error={error} hint={hint} className={containerClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full appearance-none rounded-lg border bg-surface pl-3 pr-8 text-body transition-colors",
            "focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted",
            controlSize,
            error
              ? "border-danger focus:border-danger focus:ring-red-500/20"
              : "border-line focus:border-primary-600 focus:ring-primary-600/20",
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children ||
            options.map((opt) =>
              typeof opt === "string" ? (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ) : (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              )
            )}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
      </div>
    </Field>
  );
});

export default Select;
