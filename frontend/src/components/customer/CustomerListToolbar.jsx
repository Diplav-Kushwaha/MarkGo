import { Input, Select, Button } from "../../components/ui";

/**
 * Read-only list toolbar for the customer dashboard: a search box, a row of
 * dropdown filters and an optional Reset. It only drives search / filter / sort
 * queries — there are no action controls, matching the read-only portal.
 */
export default function CustomerListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters = [],
  onReset,
  hasFilters = false,
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-card border border-primary-100/70 bg-white/95 p-4 shadow-card sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        type="search"
        aria-label="Search"
        placeholder={searchPlaceholder}
        value={searchValue || ""}
        onChange={(event) => onSearchChange(event.target.value)}
        containerClassName="sm:w-64"
      />

      {filters.map((filter) => (
        <Select
          key={filter.key}
          aria-label={filter.ariaLabel}
          containerClassName="sm:w-44"
          value={filter.value ?? ""}
          onChange={(event) => filter.onChange(event.target.value)}
          options={filter.options}
          placeholder={filter.placeholder}
        />
      ))}

      {onReset && (
        <Button variant="ghost" onClick={onReset} disabled={!hasFilters} className="sm:ml-auto">
          Reset
        </Button>
      )}
    </div>
  );
}
