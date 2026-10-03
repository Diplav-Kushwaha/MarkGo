import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { getCustomers } from "../../api/customerAdminApi";
import { cn } from "../../lib/cn";

export default function CustomerPickerField({ value, onChange, error, disabled }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (search.length < 2 && !open) return;
      try {
        setLoading(true);
        const res = await getCustomers({ search, pageSize: 50 });
        if (res.success) setCustomers(res.data.customers || []);
      } catch {
        // The dropdown simply stays empty; the field is not required to fetch.
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timer);
  }, [search, open]);

  const selected = customers.find((c) => c.id === value);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">
        Customer <span className="text-danger">*</span>
      </label>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          type="text"
          value={open ? search : selected?.name || ""}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          placeholder="Search by customer name or email…"
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-9 w-full rounded-lg border bg-surface pl-9 pr-9 text-sm text-ink transition-colors",
            "placeholder:text-muted focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50",
            error
              ? "border-danger focus:border-danger focus:ring-red-500/20"
              : "border-line focus:border-primary-600 focus:ring-primary-600/20"
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary-600" />
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-pop">
            {customers.length === 0 ? (
              <p className="px-4 py-3 text-center text-sm text-muted">
                {loading ? "Searching…" : "No customers found"}
              </p>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    onChange(customer);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full flex-col gap-0.5 border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-ink">{customer.name}</span>
                  <span className="text-xs text-muted">{customer.email}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
