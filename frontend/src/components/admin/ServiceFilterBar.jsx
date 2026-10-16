import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "../ui";
import { SERVICE_STATUS_FILTERS, SERVICE_SORT_OPTIONS } from "../../lib/serviceConstants";

/**
 * Filter bar for the Services page.
 *
 * Visually mirrors the shared DirectoryToolbar and the product filter bar (same
 * wrapper, input sizing and Reset button) but is service-specific:
 *   1. the search is debounced, so typing fires one request after a short pause;
 *   2. it offers only the new service vocabulary — Available / Not available and
 *      the six sort orders. Services have no stock, so there is deliberately no
 *      stock filter, and no type filter either (the page is always services).
 *
 * The shared DirectoryToolbar and the product filter bar are left untouched.
 */

const DEBOUNCE_MS = 300;

export default function ServiceFilterBar({
  searchValue,
  onSearchChange,
  statusValue,
  onStatusChange,
  sortValue,
  onSortChange,
  onReset,
}) {
  // The page owns the applied search value; this component keeps a local draft
  // so the input stays responsive while requests are debounced.
  const [draft, setDraft] = useState(searchValue);
  const [appliedValue, setAppliedValue] = useState(searchValue);
  const timer = useRef(null);

  // Re-sync when the search is changed from outside (Reset, filter change).
  if (searchValue !== appliedValue) {
    setAppliedValue(searchValue);
    setDraft(searchValue);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const submitSearch = (value) => {
    clearTimeout(timer.current);
    setAppliedValue(value);
    onSearchChange(value);
  };

  const handleSearchChange = (value) => {
    setDraft(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setAppliedValue(value);
      onSearchChange(value);
    }, DEBOUNCE_MS);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-white p-4 shadow-card">
      <div className="min-w-64 flex-1">
        <label className="sr-only" htmlFor="service-search">
          Search services
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            id="service-search"
            value={draft}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitSearch(draft);
              }
            }}
            placeholder="Search by name or service code…"
            containerClassName="flex items-center"
            className="pl-9 pr-9"
          />
          {draft && (
            <button
              type="button"
              onClick={() => {
                setDraft("");
                submitSearch("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <Select
        aria-label="Filter by status"
        containerClassName="w-44"
        value={statusValue}
        onChange={(e) => onStatusChange(e.target.value)}
        options={SERVICE_STATUS_FILTERS}
      />

      <Select
        aria-label="Sort services"
        containerClassName="w-52"
        value={sortValue}
        onChange={(e) => onSortChange(e.target.value)}
        options={SERVICE_SORT_OPTIONS}
      />

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
  );
}
