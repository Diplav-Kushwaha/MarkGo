import { useCallback, useEffect, useMemo, useState } from "react";
import { getVendors, getVendorStats } from "../../../api/vendorAdminApi";
import { DEFAULT_PAGE_SIZE } from "./vendorConstants";
import { isFilled } from "./vendorFormatters";

const DEFAULT_QUERY = {
  search: "",
  status: "",
  vendorType: "",
  category: "",
  minOutstanding: "",
  maxOutstanding: "",
  sortBy: "createdAt",
  sortOrder: "desc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const EMPTY_PAGINATION = {
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  totalPages: 1,
};

// Only send parameters the backend actually reads, and only when they carry a
// value — empty query strings would otherwise be treated as real filters.
function buildListParams(query) {
  const params = {
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  };
  if (isFilled(query.search)) params.search = query.search.trim();
  if (isFilled(query.status)) params.status = query.status;
  if (isFilled(query.vendorType)) params.vendorType = query.vendorType;
  if (isFilled(query.category)) params.category = query.category.trim();
  if (isFilled(query.minOutstanding)) params.minOutstanding = query.minOutstanding;
  if (isFilled(query.maxOutstanding)) params.maxOutstanding = query.maxOutstanding;
  return params;
}

/**
 * Owns everything read-only about the vendor list: the applied query, the
 * current page of rows, aggregate stats, and row selection.
 *
 * `query` is the single source of truth. Changing a filter resets the page to
 * 1 (otherwise an offset from the previous filter set would be applied to a
 * different result set); changing only the page keeps the filters intact.
 */
export default function useVendorList() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [vendors, setVendors] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [reloadToken, setReloadToken] = useState(0);

  // ---- Fetch the current page -------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadVendors() {
      setLoading(true);
      setError("");
      try {
        const response = await getVendors(buildListParams(query));
        if (cancelled) return;

        if (response?.success && response.data) {
          setVendors(response.data.vendors ?? []);
          setPagination(response.data.pagination ?? EMPTY_PAGINATION);
        } else {
          setVendors([]);
          setPagination(EMPTY_PAGINATION);
          setError("The server returned an unexpected response.");
        }
      } catch (requestError) {
        if (cancelled) return;
        setVendors([]);
        setPagination(EMPTY_PAGINATION);
        setError(
          requestError.response?.data?.message || "Failed to load vendors. Please try again."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadVendors();
    return () => {
      cancelled = true;
    };
  }, [query, reloadToken]);

  // ---- Fetch company-wide stats ----------------------------------------------
  // The stats endpoint takes no filters, so these are whole-company totals and
  // deliberately do not re-run when the user changes a filter.
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);

    getVendorStats()
      .then((response) => {
        if (!cancelled && response?.success) setStats(response.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // ---- Keep the page in range after a delete --------------------------------
  // Deleting the last row of the last page would otherwise leave the user on an
  // empty page with no way back except the pager.
  useEffect(() => {
    if (
      !loading &&
      vendors.length === 0 &&
      pagination.total > 0 &&
      query.page > pagination.totalPages
    ) {
      setQuery((previous) => ({
        ...previous,
        page: Math.max(1, pagination.totalPages),
      }));
    }
  }, [loading, vendors.length, pagination.total, pagination.totalPages, query.page]);

  // ---- Selection -------------------------------------------------------------
  // Cleared whenever the underlying result set changes (filters, sorting or
  // page size) but preserved across plain page navigation, so rows can be
  // selected across pages of the same filtered list.
  const selectionScope = [
    query.search,
    query.status,
    query.vendorType,
    query.category,
    query.minOutstanding,
    query.maxOutstanding,
    query.sortBy,
    query.sortOrder,
    query.pageSize,
  ].join("|");

  useEffect(() => {
    setSelectedIds([]);
  }, [selectionScope]);

  const toggleSelect = useCallback((vendorId) => {
    setSelectedIds((previous) =>
      previous.includes(vendorId)
        ? previous.filter((id) => id !== vendorId)
        : [...previous, vendorId]
    );
  }, []);

  const pageVendorIds = useMemo(() => vendors.map((vendor) => vendor.id), [vendors]);

  const allOnPageSelected =
    pageVendorIds.length > 0 && pageVendorIds.every((id) => selectedIds.includes(id));

  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedIds((previous) => {
      const everySelected =
        pageVendorIds.length > 0 && pageVendorIds.every((id) => previous.includes(id));
      if (everySelected) {
        return previous.filter((id) => !pageVendorIds.includes(id));
      }
      const merged = new Set(previous);
      pageVendorIds.forEach((id) => merged.add(id));
      return Array.from(merged);
    });
  }, [pageVendorIds]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  // ---- Query mutations -------------------------------------------------------
  const FILTER_KEYS = [
    "search",
    "status",
    "vendorType",
    "category",
    "minOutstanding",
    "maxOutstanding",
  ];

  const updateQuery = useCallback((patch) => {
    setQuery((previous) => {
      const next = { ...previous, ...patch };
      const filterTouched = FILTER_KEYS.some(
        (key) => key in patch && patch[key] !== previous[key]
      );
      if (filterTouched && !("page" in patch)) {
        next.page = 1;
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setQuery((previous) => ({
      ...DEFAULT_QUERY,
      sortBy: previous.sortBy,
      sortOrder: previous.sortOrder,
      pageSize: previous.pageSize,
    }));
  }, []);

  const toggleSort = useCallback((column) => {
    setQuery((previous) => {
      if (previous.sortBy === column) {
        return {
          ...previous,
          sortOrder: previous.sortOrder === "asc" ? "desc" : "asc",
          page: 1,
        };
      }
      return { ...previous, sortBy: column, sortOrder: "asc", page: 1 };
    });
  }, []);

  const goToPage = useCallback((page) => updateQuery({ page }), [updateQuery]);

  const setPageSize = useCallback((size) => updateQuery({ pageSize: size, page: 1 }), [
    updateQuery,
  ]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  const activeFilterCount = FILTER_KEYS.filter(
    (key) => key !== "search" && isFilled(query[key])
  ).length;

  return {
    query,
    updateQuery,
    resetFilters,
    activeFilterCount,
    toggleSort,
    vendors,
    pagination,
    stats,
    loading,
    statsLoading,
    error,
    selectedIds,
    toggleSelect,
    toggleSelectAllOnPage,
    allOnPageSelected,
    clearSelection,
    goToPage,
    setPageSize,
    refresh,
  };
}
