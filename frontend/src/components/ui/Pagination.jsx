import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import Select from "./Select";

const PAGE_SIZES = [10, 25, 50, 100];

export default function Pagination({
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onPageSizeChange,
  className,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  // Windowed page numbers with ellipses: 1 … 4 5 6 … 20
  const pages = [];
  const push = (value) => {
    if (pages[pages.length - 1] !== value) pages.push(value);
  };

  push(1);
  for (let p = current - 1; p <= current + 1; p += 1) {
    if (p > 1 && p < totalPages) push(p);
  }
  if (totalPages > 1) push(totalPages);

  const go = (next) => {
    const target = Math.min(Math.max(1, next), totalPages);
    if (target !== current) onPageChange?.(target);
  };

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span>
          Showing <span className="font-medium text-ink">{from}</span>–
          <span className="font-medium text-ink">{to}</span> of{" "}
          <span className="font-medium text-ink">{total}</span>
        </span>
        {onPageSizeChange && (
          <Select
            size="sm"
            aria-label="Rows per page"
            containerClassName="w-auto"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            options={PAGE_SIZES.map((size) => ({ value: size, label: `${size} / page` }))}
          />
        )}
      </div>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={current <= 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-body transition-colors hover:bg-slate-50 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {pages.map((p, index) => {
          const previous = pages[index - 1];
          const gap = previous !== undefined && p - previous > 1;

          return (
            <span key={p} className="flex items-center gap-1">
              {gap && <span className="px-1 text-xs text-muted">…</span>}
              <button
                type="button"
                onClick={() => go(p)}
                aria-current={p === current ? "page" : undefined}
                className={cn(
                  "h-8 min-w-8 rounded-lg border px-2 text-xs font-medium transition-colors",
                  p === current
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-line text-body hover:bg-slate-50 hover:text-ink"
                )}
              >
                {p}
              </button>
            </span>
          );
        })}

        <button
          type="button"
          onClick={() => go(current + 1)}
          disabled={current >= totalPages}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-body transition-colors hover:bg-slate-50 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
