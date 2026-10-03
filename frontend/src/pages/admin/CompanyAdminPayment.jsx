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
      color: "text-emerald-600",
      bg: "bg-emerald-50",
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
      color: summary.net >= 0 ? "text-blue-600" : "text-rose-600",
      bg: summary.net >= 0 ? "bg-blue-50" : "bg-rose-50",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Payments &amp; Bank</h2>
          <p className="text-xs text-gray-500 mt-0.5">A single ledger of money received from customers and money paid to vendors.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-lg ${card.bg} ${card.color}`}>{card.icon}</div>
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{card.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg self-start">
          {DIRECTION_TABS.map((tab) => {
            const isActive = (searchParams.get("direction") || "") === tab.key;
            return (
              <button
                key={tab.key || "all"}
                onClick={() => updateFilter("direction", tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  isActive ? "bg-white text-[#3ACF99] shadow-sm" : "text-gray-500 hover:text-gray-700"
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
            className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => updateFilter("from", e.target.value)}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none"
          />
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => updateFilter("to", e.target.value)}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none"
          />
          <button
            onClick={() => {
              setSearchInput("");
              setLoading(true);
              setError("");
              setSearchParams({});
            }}
            className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 rounded-lg transition"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500">Fetching payments...</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center">
            <p className="text-sm font-bold text-red-600">{error}</p>
            <p className="text-xs text-gray-500 mt-1">Please try again.</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm font-bold text-gray-800">No payments found</p>
            <p className="text-xs text-gray-500 mt-1">
              Payments are recorded from the invoice and bill screens.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
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
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {payments.map((payment) => {
                  const isIn = !!payment.invoice && !payment.bill;
                  const party = payment.invoice?.customer?.name || payment.bill?.vendor?.name || "N/A";
                  const reference = payment.invoice?.invoiceNumber || payment.bill?.billNumber || "N/A";
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-6 py-4 font-semibold whitespace-nowrap">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            isIn
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {isIn ? "Received" : "Sent"}
                        </span>
                      </td>
                      <td className="px-6 py-4">{party}</td>
                      <td className="px-6 py-4 text-gray-500">{reference}</td>
                      <td className="px-6 py-4">{String(payment.method || "").replace("_", " ")}</td>
                      <td className="px-6 py-4 text-gray-500">{payment.note || "N/A"}</td>
                      <td className={`px-6 py-4 text-right font-bold ${isIn ? "text-emerald-600" : "text-red-600"}`}>
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{pagination.total}</span> payment(s)
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => updateFilter("page", String(pagination.page - 1), true)}
              className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page <span className="font-semibold text-gray-700">{pagination.page}</span> of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateFilter("page", String(pagination.page + 1), true)}
              className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
