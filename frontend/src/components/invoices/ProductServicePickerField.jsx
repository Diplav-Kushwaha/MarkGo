import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { getItems } from "../../api/itemAdminApi";
import { formatCurrency } from "../../lib/format";

export default function ProductServicePickerField({ type, value, onChange, disabled }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const res = await getItems({ search, type, pageSize: 50 });
        if (res.success) setItems(res.data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [search, type]);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        type="text"
        value={open ? search : value || ""}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder={`Search ${type === "SERVICE" ? "services" : "products"}…`}
        className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm text-ink transition-colors placeholder:text-muted focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary-600" />
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-pop">
            {items.length === 0 ? (
              <p className="px-4 py-3 text-center text-sm text-muted">
                {loading ? "Searching…" : "No items found"}
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full flex-col gap-0.5 border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-ink">{item.name}</span>
                  <span className="text-xs text-muted">
                    {item.sku ? `SKU: ${item.sku} · ` : ""}
                    {formatCurrency(item.salesPrice)} / {item.unit}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
