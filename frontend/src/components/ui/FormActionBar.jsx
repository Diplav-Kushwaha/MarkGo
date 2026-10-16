import { cn } from "../../lib/cn";

/**
 * Sticky bottom action bar for forms. `inset` bleeds the bar past the layout's
 * horizontal padding; turn it off when the bar sits inside a bordered card.
 */
export default function FormActionBar({ children, inset = true, className }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-line bg-white/90 px-6 py-4 shadow-[0_-8px_24px_rgba(76,61,160,0.06)] backdrop-blur",
        inset ? "-mx-6 mt-6" : "",
        className
      )}
    >
      {children}
    </div>
  );
}
