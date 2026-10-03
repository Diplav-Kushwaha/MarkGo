import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../../lib/cn";

const TONES = {
  error: {
    wrap: "border-danger-line bg-danger-soft text-red-700",
    Icon: AlertCircle,
  },
  success: {
    wrap: "border-success-line bg-success-soft text-green-700",
    Icon: CheckCircle2,
  },
  info: {
    wrap: "border-info-line bg-info-soft text-sky-800",
    Icon: Info,
  },
};

export default function Alert({ tone = "error", title, children, className }) {
  const { wrap, Icon } = TONES[tone] || TONES.error;

  return (
    <div role="alert" className={cn("flex gap-3 rounded-lg border px-4 py-3", wrap, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "break-words")}>{children}</div>}
      </div>
    </div>
  );
}
