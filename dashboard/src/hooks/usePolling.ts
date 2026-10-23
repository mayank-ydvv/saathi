import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError, Result } from "../api/client";

export interface Polled<T> {
  data: T | null;
  error: ApiError | null;
  /** True until the first answer (data or error) arrives. */
  loading: boolean;
  /** Fetch again now (e.g. after an ack or a Retry click). */
  refresh: () => void;
}

/**
 * Calls `fetcher` now and then every `intervalMs` (null = once), but only while the page is
 * visible (Page Visibility API): hidden tabs stop polling and refetch as soon as they're shown.
 * Each new request aborts the previous one, so a slow stale answer can never overwrite a newer
 * one. On error the last good data is kept. `key` restarts the cycle (e.g. a new date).
 */
export function usePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<Result<T>>,
  intervalMs: number | null,
  key = "",
): Polled<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [answered, setAnswered] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const runRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let ctrl: AbortController | null = null;
    let timer: number | undefined;
    let stopped = false;
    setData(null);
    setError(null);
    setAnswered(false);

    const schedule = () => {
      window.clearTimeout(timer);
      if (intervalMs !== null && !stopped && document.visibilityState === "visible") {
        timer = window.setTimeout(run, intervalMs);
      }
    };

    async function run() {
      ctrl?.abort();
      const mine = new AbortController();
      ctrl = mine;
      let result: Result<T>;
      try {
        result = await fetcherRef.current(mine.signal);
      } catch (err) {
        // A fetcher that throws must not stop polling for good (M8).
        result = { ok: false, error: { kind: "network", message: err instanceof Error ? err.message : "error" } };
      }
      if (stopped || mine.signal.aborted) return;
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else if (result.error.kind !== "aborted") {
        setError(result.error);
      }
      setAnswered(true);
      schedule();
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") void run();
      else {
        window.clearTimeout(timer);
        ctrl?.abort();
      }
    };

    runRef.current = () => void run();
    void run();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, key]);

  const refresh = useCallback(() => runRef.current(), []);
  return { data, error, loading: !answered, refresh };
}
