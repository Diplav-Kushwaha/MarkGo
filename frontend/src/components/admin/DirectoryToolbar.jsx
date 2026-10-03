import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "../ui";

/**
 * Search + filter bar for the directory list pages. The search box keeps a local
 * draft so typing does not fire a request per keystroke; `searchValue` is the
 * applied value owned by the page.
 */
export default function DirectoryToolbar({
  searchValue,
  onSearchSubmit,
  searchPlaceholder = "Search…",
  filters = [],
  onReset,
  right,
}) {
  const [draft, setDraft] = useState(searchValue);
  const [appliedValue, setAppliedValue] = useState(searchValue);

  // Adjust the draft while rendering when the page clears the search (Reset or a
  // filter change), which keeps the input in sync without an extra effect.
  if (searchValue !== appliedValue) {
    setAppliedValue(searchValue);
    setDraft(searchValue);
  }

  const submit = (value) => {
    setAppliedValue(value);
    onSearchSubmit?.(value);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(draft);
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-3 shadow-card"
    >
      <div className="min-w-64 flex-1">
        <label className="sr-only" htmlFor="directory-search">
          Search
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            id="directory-search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={searchPlaceholder}
            containerClassName="flex items-center"
            className="pl-9 pr-9"
          />
          {draft && (
            <button
              type="button"
              onClick={() => {
                setDraft("");
                submit("");
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted transition-colors hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={filter.value}
          onChange={(e) => filter.onChange(e.target.value)}
          options={filter.options}
          placeholder={filter.placeholder}
          containerClassName="w-48"
          aria-label={filter.label}
        />
      ))}

      <div className="ml-auto flex items-center gap-2">
        {right}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="h-9 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-slate-100 hover:text-ink"
          >
            Reset
          </button>
        )}
      </div>
    </form>
  );
}
