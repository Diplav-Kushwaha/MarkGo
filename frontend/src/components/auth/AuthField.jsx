import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";

/**
 * Form primitives for the MarkGo auth screens. Mirrors the Super Admin login
 * input, label, error and alert styling. Presentational only.
 */

const LABEL = "block text-sm font-semibold text-ink";
const CONTROL_BASE =
  "block h-11 w-full rounded-control border bg-white py-2.5 text-sm text-ink shadow-sm transition-all duration-150 " +
  "placeholder:text-muted focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-muted-soft";

/** `trailing` reserves room for a right-hand control such as the password toggle. */
function controlClass({ invalid, leading = true, trailing = true }) {
  return [
    CONTROL_BASE,
    leading ? "pl-11" : "pl-4",
    trailing ? "pr-11" : "pr-4",
    invalid
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-line focus:border-primary-500 focus:ring-primary-500/20",
  ].join(" ");
}

/** Inline validation message, linked to its control via aria-describedby. */
export function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs text-red-600">
      {message}
    </p>
  );
}

export function FieldHint({ children }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-muted">{children}</p>;
}

/**
 * Label + control + optional hint/error. `icon` renders inside the control on
 * the left; `trailingSlot` renders a button pinned to the right edge.
 */
export default function AuthField({
  id,
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  required = false,
  autoComplete,
  disabled = false,
  error = "",
  hint,
  icon: Icon,
  trailingSlot,
  className = "",
  inputRef,
}) {
  const hasError = Boolean(error);

  return (
    <div className={className}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative mt-1.5">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        )}
        <input
          id={id}
          ref={inputRef}
          name={name}
          type={type}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={controlClass({ invalid: hasError, trailing: Boolean(trailingSlot) })}
        />
        {trailingSlot && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {trailingSlot}
          </div>
        )}
      </div>
      {hint && !hasError && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** Password input with a show/hide toggle, matching the reference page. */
export function AuthPasswordField({
  id,
  label,
  name,
  value,
  onChange,
  placeholder = "••••••••",
  required = false,
  autoComplete = "current-password",
  disabled = false,
  error = "",
  hint,
  labelAction,
  className = "",
}) {
  const [visible, setVisible] = useState(false);
  const hasError = Boolean(error);

  return (
    <div className={className}>
      {labelAction ? (
        <div className="flex items-baseline justify-between">
          <label htmlFor={id} className={LABEL}>
            {label}
          </label>
          {labelAction}
        </div>
      ) : (
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
      )}

      <div className="relative mt-1.5">
        <Lock
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={controlClass({ invalid: hasError, trailing: true })}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-control text-muted transition-colors hover:bg-primary-50 hover:text-ink disabled:opacity-50"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {hint && !hasError && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** Top-level error alert, matching the reference page. */
export function AuthAlert({ message, tone = "error" }) {
  if (!message) return null;

  const styles =
    tone === "success"
      ? "border-success-line bg-success-soft text-green-800"
      : "border-danger-line bg-danger-soft text-red-800";

  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={tone === "success" ? "status" : "alert"}
      className={`mt-6 flex items-start gap-2.5 rounded-xl border px-4 py-3 ${styles}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

/** Small uppercase section heading for the wider registration form. */
export function AuthSectionHeading({ children }) {
  return (
    <h3 className="border-b border-line pb-2 text-xs font-bold uppercase tracking-wider text-muted">
      {children}
    </h3>
  );
}
