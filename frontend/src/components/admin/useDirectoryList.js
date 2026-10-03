import { useCallback, useEffect, useState } from "react";

const EMPTY_PAGINATION = { total: 0, page: 1, pageSize: 10, totalPages: 1 };

/**
 * `fetchStats` may be either one of the shared API helpers — which return the
 * full `{ success, data }` envelope — or a hand-written fetcher that already
 * returns the stats object. Normalise both to the inner object so callers can
 * always read `stats.totalCustomers` and friends.
 */
function unwrapStats(result) {
  if (!result || typeof result !== "object") return null;
  if (result.success === false) return null;
  if (result.data && typeof result.data === "object") return result.data;
  return result;
}

/**
 * Shared list state for the admin directory pages (customers, vendors, team).
 *
 * The page owns two small adapters:
 *   fetchPage(params)  -> Promise<{ rows, total, page, pageSize, totalPages } | null>
 *   fetchStats()       -> Promise<object | null>
 *
 * Everything else — the query object, paging, filter-resets-page-to-1, loading
 * and error state — lives here so the three pages behave identically.
 */
export default function useDirectoryList({ fetchPage, fetchStats, initialQuery, onStatsChange }) {
  const [query, setQuery] = useState(initialQuery);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchPage(query);
        if (cancelled) return;

        const next = {
          total: result?.total ?? 0,
          page: result?.page ?? query.page ?? 1,
          pageSize: result?.pageSize ?? query.pageSize ?? 10,
          totalPages: result?.totalPages ?? 1,
        };

        // Deleting the last row of the last page would otherwise leave an empty
        // table with no way back. Re-run at the last valid page instead of
        // rendering the empty result first.
        if (next.total > 0 && query.page > next.totalPages) {
          setQuery((previous) => ({ ...previous, page: next.totalPages }));
          return;
        }

        setRows(result?.rows ?? []);
        setPagination(next);
      } catch (requestError) {
        if (cancelled) return;
        setRows([]);
        setPagination(EMPTY_PAGINATION);
        setError(requestError.response?.data?.message || "Something went wrong. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // fetchPage/fetchStats are stable module-level adapters supplied by the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, reloadToken]);

  // Stats are whole-company totals, so they intentionally ignore the filters and
  // only re-run when the list is reloaded after a mutation. The previous values
  // stay on screen while refreshing rather than flashing the skeleton again.
  useEffect(() => {
    let cancelled = false;

    fetchStats()
      .then((result) => {
        if (cancelled) return;
        const next = unwrapStats(result);
        setStats(next);
        // Lets a parent (e.g. the Team page) render these numbers elsewhere,
        // without a second request.
        onStatsChange?.(next);
      })
      .catch(() => {
        if (cancelled) return;
        setStats(null);
        onStatsChange?.(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  const setFilter = useCallback((key, value) => {
    setQuery((previous) => ({ ...previous, [key]: value, page: 1 }));
  }, []);

  const setPage = useCallback((page) => {
    setQuery((previous) => ({ ...previous, page }));
  }, []);

  const setPageSize = useCallback((pageSize) => {
    setQuery((previous) => ({ ...previous, pageSize, page: 1 }));
  }, []);

  const resetFilters = useCallback(() => {
    setQuery((previous) => ({ ...initialQuery, pageSize: previous.pageSize }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    query,
    rows,
    pagination,
    stats,
    loading,
    statsLoading,
    error,
    setFilter,
    setPage,
    setPageSize,
    resetFilters,
    reload,
  };
}
