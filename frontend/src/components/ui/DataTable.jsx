import { cn } from "../../lib/cn";

const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * columns: [{ key, header, align, width, className, headerClassName, render(row, index) }]
 */
export default function DataTable({
  columns,
  rows = [],
  rowKey = "id",
  loading = false,
  skeletonRows = 8,
  empty,
  onRowClick,
  className,
  maxHeight,
  // Set when the table sits inside a Card, so it does not draw a second border.
  contained = false,
}) {
  const colCount = columns.length;

  return (
    <div
      className={cn(
        contained ? "overflow-hidden" : "overflow-hidden rounded-card border border-line bg-white shadow-card",
        maxHeight,
        className
      )}
    >
      <div className="overflow-auto scrollbar-slim">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-primary-50/70">
            <tr className="border-b border-line">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    "whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-body",
                    ALIGN[col.align || "left"],
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {loading ? (
            <tbody>
              {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="border-b border-line last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-3.5">
                      <div className="h-3.5 w-full max-w-40 animate-pulse rounded bg-[#E8E4F3]" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : rows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={colCount} className="p-0">
                  {empty}
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={
                    typeof rowKey === "function" ? rowKey(row, index) : (row[rowKey] ?? index)
                  }
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-line transition-colors last:border-0",
                    onRowClick && "cursor-pointer hover:bg-primary-50/70"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-5 py-3.5 align-middle text-body",
                        ALIGN[col.align || "left"],
                        col.className
                      )}
                    >
                      {col.render ? col.render(row, index) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
