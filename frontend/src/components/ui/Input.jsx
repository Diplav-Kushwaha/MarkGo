import { forwardRef, useId } from "react";
import { cn } from "../../lib/cn";

const CONTROL_BASE =
  "w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-muted " +
  "focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted";

const CONTROL_STATE = (invalid) =>
  invalid
    ? "border-danger focus:border-danger focus:ring-red-500/20"
    : "border-line focus:border-primary-600 focus:ring-primary-600/20";

export function Field({ label, htmlFor, required, error, hint, className, children }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const Input = forwardRef(function Input(
  { label, error, hint, required, className, containerClassName, id, prefix, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || props.name || generatedId;

  const control = (
    <input
      ref={ref}
      id={inputId}
      aria-invalid={error ? true : undefined}
      className={cn(
        CONTROL_BASE,
        CONTROL_STATE(error),
        "h-9",
        prefix ? "pl-7" : "",
        className
      )}
      {...props}
    />
  );

  return (
    <Field label={label} htmlFor={inputId} required={required} error={error} hint={hint} className={containerClassName}>
      {prefix ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            {prefix}
          </span>
          {control}
        </div>
      ) : (
        control
      )}
    </Field>
  );
});

const Textarea = forwardRef(function Textarea(
  { label, error, hint, required, className, containerClassName, id, rows = 3, ...props },
  ref
) {
  const generatedId = useId();
  const fieldId = id || props.name || generatedId;

  return (
    <Field label={label} htmlFor={fieldId} required={required} error={error} hint={hint} className={containerClassName}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL_BASE, CONTROL_STATE(error), "py-2 resize-y", className)}
        {...props}
      />
    </Field>
  );
});

export { Input, Textarea };
export default Input;
