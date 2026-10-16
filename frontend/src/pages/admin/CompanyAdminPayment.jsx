import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getPayments, getPaymentSummary } from "../../api/paymentAdminApi";
import { formatCurrency } from "../../lib/format";

const PAGE_SIZE = 10;

const DIRECTION_TABS = [
  { key: "", label: "All" },
  { key: "IN", label: "Money In" },
  { key: "OUT", label: "Money Out" },
];

const EMPTY_SUMMARY = { totalIn: 0, totalOut: 0, net: 0 };

export default function CompanyAdminPayment() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const dateRange = {
    from: searchParams.get("from") || "",
    to: searchParams.get("to") || "",
  };

  const updateFilter = (key, value, keepPage = false) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set(key, value);
    else newParams.delete(key);
    if (!keepPage) newParams.delete("page");
    setLoading(true);
    setError("");
    setSearchParams(newParams);
  };

  useEffect(() => {
    let active = true;
    const params = Object.fromEntries(searchParams.entries());
    Promise.all([
      getPayments({ pageSize: PAGE_SIZE, ...params }),
      getPaymentSummary({ from: dateRange.from || undefined, to: dateRange.to || undefined }),
    ])
      .then(([listRes, summaryRes]) => {
        if (!active) return;
        if (listRes.success) {
          setPayments(listRes.data.payments || []);
          if (listRes.data.pagination) setPagination(listRes.data.pagination);
        }
        if (summaryRes.success) setSummary({ ...EMPTY_SUMMARY, ...summaryRes.data });
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Failed to load payments.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [searchParams, dateRange.from, dateRange.to]);

  const updateSearch = useCallback((value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set("search", value);
    else newParams.delete("search");
    newParams.delete("page");
    setLoading(true);
    setError("");
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput === (searchParams.get("search") || "")) return;
      updateSearch(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, searchParams, updateSearch]);

  const summaryCards = [
    {
      label: "Total In",
      value: formatCurrency(summary.totalIn),
      color: "text-success",
      bg: "bg-success-soft",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m0 0l-4-4m4 4l4-4M4 8h16" />
        </svg>
      ),
    },
    {
      label: "Total Out",
      value: formatCurrency(summary.totalOut),
      color: "text-red-600",
      bg: "bg-red-50",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 20V4m0 0L8 8m4-4l4 4M4 16h16" />
        </svg>
      ),
    },
    {
      label: "Net",
      value: formatCurrency(summary.net),
      color: summary.net >= 0 ? "text-success" : "text-danger",
      bg: summary.net >= 0 ? "bg-success-soft" : "bg-danger-soft",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 rounded-card border border-primary-100/70 bg-white/95 p-6 shadow-card sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">Payments &amp; Bank</h2>
          <p className="mt-0.5 text-sm text-muted">A single ledger of money received from customers and money paid to vendors.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="flex items-center gap-4 rounded-card border border-primary-100/70 bg-white/95 p-5 shadow-card">
            <div className={`rounded-tile p-3 ${card.bg} ${card.color}`}>{card.icon}</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{card.label}</p>
              <p className="mt-0.5 text-lg font-bold text-ink">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-card border border-primary-100/70 bg-white/95 p-4 shadow-card lg:flex-row">
        <div className="flex items-center gap-1 self-start rounded-full border border-primary-100 bg-primary-50/70 p-1">
          {DIRECTION_TABS.map((tab) => {
            const isActive = (searchParams.get("direction") || "") === tab.key;
            return (
              <button
                key={tab.key || "all"}
                onClick={() => updateFilter("direction", tab.key)}
                className={`min-h-9 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive ? "bg-primary-700 text-white shadow-sm" : "text-body hover:bg-white hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by reference, party or note..."
            className="h-11 w-full rounded-control border border-line bg-white px-3.5 text-sm text-ink outline-none placeholder:text-muted focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => updateFilter("from", e.target.value)}
            className="h-10 rounded-control border border-line bg-white px-3 text-sm text-body outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => updateFilter("to", e.target.value)}
            className="h-10 rounded-control border border-line bg-white px-3 text-sm text-body outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
          <button
            onClick={() => {
              setSearchInput("");
              setLoading(true);
              setError("");
              setSearchParams({});
            }}
            className="min-h-10 rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-primary-50 hover:text-ink"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-card border border-primary-100/70 bg-white/95 shadow-card">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-2">
            <div className="w-8 h-8 animate-spin rounded-full border-4 border-success border-t-transparent" />
            <p className="text-xs text-muted">Fetching payments...</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center">
            <p className="text-sm font-bold text-red-600">{error}</p>
            <p className="mt-1 text-xs text-muted">Please try again.</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm font-bold text-ink">No payments found</p>
            <p className="mt-1 text-xs text-muted">
              Payments are recorded from the invoice and bill screens.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-primary-50/60 text-[10px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Party</th>
                  <th className="px-6 py-4">Reference</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Note</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-body">
                {payments.map((payment) => {
                  const isIn = !!payment.invoice && !payment.bill;
                  const party = payment.invoice?.customer?.name || payment.bill?.vendor?.name || "N/A";
                  const reference = payment.invoice?.invoiceNumber || payment.bill?.billNumber || "N/A";
                  return (
                    <tr key={payment.id} className="transition-colors hover:bg-primary-50/60">
                      <td className="px-6 py-4 font-semibold whitespace-nowrap">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            isIn
                              ? "bg-success-soft text-green-700 border-success-line"
                              : "bg-danger-soft text-red-700 border-danger-line"
                          }`}
                        >
                          {isIn ? "Received" : "Sent"}
                        </span>
                      </td>
                      <td className="px-6 py-4">{party}</td>
                      <td className="px-6 py-4 text-muted">{reference}</td>
                      <td className="px-6 py-4">{String(payment.method || "").replace("_", " ")}</td>
                      <td className="px-6 py-4 text-muted">{payment.note || "N/A"}</td>
                      <td className={`px-6 py-4 text-right font-bold ${isIn ? "text-success" : "text-danger"}`}>
                        {isIn ? "+" : "-"}{formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && payments.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-card border border-primary-100/70 bg-white/95 p-4 shadow-card sm:flex-row">
          <p className="text-xs text-muted">
            Showing <span className="font-semibold text-ink">{pagination.total}</span> payment(s)
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => updateFilter("page", String(pagination.page - 1), true)}
              className="min-h-10 rounded-control border border-line bg-white px-3 py-2 text-xs font-semibold text-body transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-muted">
              Page <span className="font-semibold text-ink">{pagination.page}</span> of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateFilter("page", String(pagination.page + 1), true)}
              className="min-h-10 rounded-control border border-line bg-white px-3 py-2 text-xs font-semibold text-body transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
