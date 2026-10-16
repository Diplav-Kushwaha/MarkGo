import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Data hook shared by the report pages.
 *
 * The ten reports each keep their own filter state; this hook owns only the
 * request itself. `fetcher` is a module-level function that takes a query object
 * and returns the `{ success, data }` envelope, so every report behaves the same
 * way about loading, error, and stale responses.
 *
 * A request that returns after a newer one is discarded, so typing in a search
 * box can never overwrite a later result with an earlier one. `reload` re-runs
 * the same query after a mutation — the reports are read-only, so today that is
 * only used to re-run after a failed request.
 */

export default function useReportData({ fetcher, query, enabled = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  // Guards against a slow response for an old query overwriting a newer one.
  const requestId = useRef(0);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    // A page that has not produced a query yet (no item selected) stays idle
    // rather than firing a request the API would reject.
    if (!enabled) return undefined;

    const id = requestId.current + 1;
    requestId.current = id;
    let cancelled = false;

    // The pending flag is set from the microtask, not from the effect body, so
    // changing a filter never triggers a cascading render inside the effect.
    Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError("");
        return fetcher(query);
      })
      .then((response) => {
        if (cancelled || id !== requestId.current) return;
        if (!response?.success) {
          setData(null);
          setError(response?.message || "This report could not be loaded.");
          return;
        }
        setData(response.data);
      })
      .catch((requestError) => {
        if (cancelled || id !== requestId.current) return;
        setData(null);
        setError(
          requestError?.response?.data?.message ||
            requestError?.message ||
            "This report could not be loaded."
        );
      })
      .finally(() => {
        if (!cancelled && id === requestId.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `fetcher` is a module-level adapter supplied by the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, reloadToken, enabled]);

  return { data, loading, error, reload };
}
