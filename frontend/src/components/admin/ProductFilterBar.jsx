import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "../ui";

/**
 * Filter bar for the Products page.
 *
 * Visually mirrors the shared DirectoryToolbar (same wrapper, input sizing and
 * Reset button) but is product-specific for two reasons:
 *   1. the search is debounced, so typing fires one request after a short pause
 *      instead of one per keystroke or only on Enter;
 *   2. it offers the new product filter vocabulary (Available/Not available,
 *      In stock/Low stock/Out of stock and the six sort orders) rather than the
 *      legacy service filters.
 *
 * The shared DirectoryToolbar is left untouched because five other pages use it.
 */

const DEBOUNCE_MS = 300;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "notavailable", label: "Not available" },
];

const STOCK_OPTIONS = [
  { value: "", label: "All stock levels" },
  { value: "instock", label: "In stock" },
  { value: "lowstock", label: "Low stock" },
  { value: "outofstock", label: "Out of stock" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "Name (A-Z)" },
  { value: "za", label: "Name (Z-A)" },
  { value: "priceHigh", label: "Price: high to low" },
  { value: "priceLow", label: "Price: low to high" },
];

export default function ProductFilterBar({
  searchValue,
  onSearchChange,
  statusValue,
  onStatusChange,
  stockValue,
  onStockChange,
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
  // Adjusting state during render is React's supported way to respond to a prop
  // change, and avoids an effect + cascading render. Mirrors DirectoryToolbar.
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
        <label className="sr-only" htmlFor="product-search">
          Search products
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            id="product-search"
            value={draft}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitSearch(draft);
              }
            }}
            placeholder="Search by name, code or brand…"
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
        options={STATUS_OPTIONS}
      />

      <Select
        aria-label="Filter by stock level"
        containerClassName="w-44"
        value={stockValue}
        onChange={(e) => onStockChange(e.target.value)}
        options={STOCK_OPTIONS}
      />

      <Select
        aria-label="Sort products"
        containerClassName="w-48"
        value={sortValue}
        onChange={(e) => onSortChange(e.target.value)}
        options={SORT_OPTIONS}
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
