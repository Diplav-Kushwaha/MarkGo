import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * actions: [{ label, icon, onSelect, tone, disabled, hidden }]
 */
export default function RowActions({ actions = [], label = "Row actions", align = "right" }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const visible = actions.filter((action) => !action.hidden);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (visible.length === 0) return null;

  const toneClasses = {
    default: "text-body hover:bg-primary-50 hover:text-ink",
    danger: "text-red-600 hover:bg-red-50 hover:text-red-700",
    primary: "text-primary-700 hover:bg-primary-50 hover:text-primary-800",
  };

  return (
    <div ref={wrapperRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-primary-50 hover:text-ink",
          open && "bg-primary-50 text-ink"
        )}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-30 mt-1 min-w-44 overflow-hidden rounded-card border border-line bg-white py-1 shadow-pop",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {visible.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  action.onSelect?.();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-40",
                  toneClasses[action.tone || "default"]
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
