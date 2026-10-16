import { useCallback, useEffect, useRef, useState } from "react";
import DataTable from "../ui/DataTable";
import Skeleton from "../ui/Skeleton";
import { Alert } from "../ui";
import { DATE_PRESETS, presetRange } from "../../lib/reportConstants";

/**
 * Report filter bar.
 *
 * A single wrapper for every report's controls so the ten reports look and
 * behave identically: the same border, padding, gap and Reset button the
 * service/Product filter bars use, and the same debounced search.
 *
 * Every control reports its RAW value upward — including the empty string that
 * an untouched select produces — because the backend treats "", "all" and a
 * missing key identically as "no filter". Nothing is cleaned here, so a page
 * can never disagree with the API about what "no filter" means.
 *
 * The date presets and their helper live in `lib/reportConstants.js`, so this
 * file only ever exports components.
 */

const DEBOUNCE_MS = 300;


/** Debounced search input, so typing fires one request rather than one per key. */
function SearchField({ value, onChange, placeholder = "Search…", label = "Search" }) {
  const [draft, setDraft] = useState(value);
  const [applied, setApplied] = useState(value);
  const timer = useRef(null);

  // Re-sync when the value is changed from outside (Reset, another filter).
  if (value !== applied) {
    setApplied(value);
    setDraft(value);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (next) => {
    clearTimeout(timer.current);
    setApplied(next);
    onChange(next);
  };

  return (
    <div className="min-w-56 flex-1">
      <label className="sr-only" htmlFor={`report-search-${label}`}>
        {label}
      </label>
      <input
        id={`report-search-${label}`}
        type="search"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(next), DEBOUNCE_MS);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft);
          }
        }}
        placeholder={placeholder}
        className="h-11 w-full rounded-control border border-line bg-white px-3 text-sm text-ink transition-colors placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20"
      />
    </div>
  );
}


/**
 * The filter bar itself.
 *
 * `fields` is a list of `{ key, label, options, width }` descriptors, so each
 * page describes its own filters declaratively instead of hand-building a form.
 * `showDateRange` adds the presets plus the from/to pair.
 */
export default function ReportFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  searchLabel = "Search",
  fields = [],
  showDateRange = false,
  range,
  onRangeChange,
  rangeError = "",
  children,
  onReset,
}) {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-end gap-3">
        {onSearchChange && (
          <SearchField
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            label={searchLabel}
          />
        )}

        {showDateRange && (
          <>
            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-muted">Date range</span>
              <select
                value={range.preset}
                onChange={(event) => {
                  const preset = event.target.value;
                  const next = presetRange(preset);
                  onRangeChange({
                    preset,
                    from: next ? next.from : range.from,
                    to: next ? next.to : range.to,
                  });
                }}
                className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-body focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
              >
                {DATE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-muted">From</span>
              <input
                type="date"
                value={range.from}
                max={range.to || undefined}
                onChange={(event) =>
                  onRangeChange({ preset: "custom", from: event.target.value, to: range.to })
                }
                className={`h-9 rounded-lg border bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 ${
                  rangeError
                    ? "border-danger focus:border-danger focus:ring-red-500/20"
                    : "border-line focus:border-primary-600 focus:ring-primary-600/20"
                }`}
              />
            </label>

            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-muted">To</span>
              <input
                type="date"
                value={range.to}
                min={range.from || undefined}
                onChange={(event) =>
                  onRangeChange({ preset: "custom", from: range.from, to: event.target.value })
                }
                className={`h-9 rounded-lg border bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 ${
                  rangeError
                    ? "border-danger focus:border-danger focus:ring-red-500/20"
                    : "border-line focus:border-primary-600 focus:ring-primary-600/20"
                }`}
              />
            </label>
          </>
        )}

        {fields.map((field) => (
          <label key={field.key} className="space-y-1.5">
            <span className="block text-xs font-medium text-muted">{field.label}</span>
            <select
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
              className={`h-9 rounded-lg border border-line bg-surface px-3 text-sm text-body focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 ${
                field.width || "w-44"
              }`}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        {children}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="h-10 rounded-full px-4 text-sm font-semibold text-muted transition-colors hover:bg-primary-50 hover:text-ink"
          >
            Reset
          </button>
        </div>
      </div>

      {rangeError && <p className="mt-2 text-xs text-danger">{rangeError}</p>}
    </div>
  );
}

/**
 * A note explaining what a report can and cannot show.
 *
 * Reports that work from missing data (no cost recorded at the time of sale, no
 * payment status field, no expense record) render one of these instead of
 * inventing numbers, so the limitation is on the page and not only in a report.
 */
export function ReportNote({ title, items = [], tone = "info" }) {
  if (!items.length) return null;

  return (
    <Alert tone={tone} title={title}>
      <ul className="list-disc space-y-1 pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Alert>
  );
}

/**
 * Sortable, paginated table shared by the reports.
 *
 * `columns` is `[{ key, header, align, width, sortable, render }]`. Sorting is
 * requested from the server when a `sortValue` is supplied (the report's own
 * vocabulary), and applied to the current page in the browser otherwise, which
 * is what keeps a report's sort options in step with what the API accepts.
 */
export function ReportTable({
  columns,
  rows,
  loading,
  rowKey = "id",
  empty,
  sortValue,
  onSortChange,
}) {
  const [browserSort, setBrowserSort] = useState({ key: "", direction: "asc" });

  const requestSort = useCallback(
    (key) => {
      const column = columns.find((entry) => entry.key === key);
      if (!column?.sortable) return;

      if (sortValue !== undefined && onSortChange) {
        // Server-driven sort: the column names its ascending and descending
        // report values, so the toggle simply alternates between them.
        const isAscending = sortValue === column.sortAsc;
        const next = isAscending ? column.sortDesc : column.sortAsc;
        onSortChange(next);
        return;
      }

      setBrowserSort((previous) =>
        previous.key === key
          ? { key, direction: previous.direction === "asc" ? "desc" : "asc" }
          : { key, direction: "asc" }
      );
    },
    [columns, sortValue, onSortChange]
  );

  const sorted = useCallback(() => {
    if (!browserSort.key) return rows;
    const column = columns.find((entry) => entry.key === browserSort.key);
    if (!column?.value) return rows;

    return [...rows].sort((a, b) => {
      const left = column.value(a);
      const right = column.value(b);
      if (left === right) return 0;
      const result = left > right ? 1 : -1;
      return browserSort.direction === "asc" ? result : -result;
    });
  }, [rows, browserSort, columns]);

  const orderedRows = sorted();

  return (
    <DataTable
      contained
      loading={loading}
      columns={columns.map((column) => ({
        key: column.key,
        header: column.sortable ? (
          <button
            type="button"
            onClick={() => requestSort(column.key)}
            className="inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-ink"
            aria-label={`Sort by ${column.header}`}
          >
            {column.header}
            <span aria-hidden="true" className="text-[10px]">
              {sortValue !== undefined && (sortValue === column.sortAsc || sortValue === column.sortDesc)
                ? sortValue === column.sortAsc
                  ? "▲"
                  : "▼"
                : browserSort.key === column.key
                  ? browserSort.direction === "asc"
                    ? "▲"
                    : "▼"
                  : "↕"}
            </span>
          </button>
        ) : (
          column.header
        ),
        align: column.align,
        width: column.width,
        className: column.className,
        headerClassName: column.headerClassName,
        render: column.render,
      }))}
      rows={orderedRows}
      rowKey={rowKey}
      empty={empty}
    />
  );
}

/** Placeholder that matches the summary card grid while the data loads. */
export function SummaryCardsSkeleton({ count = 4 }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg border border-line bg-surface p-4 shadow-card">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-32" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
