import { cn } from "../../lib/cn";

/**
 * Sticky bottom action bar for forms. `inset` bleeds the bar past the layout's
 * horizontal padding; turn it off when the bar sits inside a bordered card.
 */
export default function FormActionBar({ children, inset = true, className }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-line bg-surface/95 px-6 py-3 backdrop-blur",
        inset ? "-mx-6 mt-6" : "",
        className
      )}
    >
      {children}
    </div>
  );
}
