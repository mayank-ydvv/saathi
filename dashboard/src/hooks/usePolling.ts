import { useEffect, useRef } from "react";

/**
 * Visibility-aware polling hook using Page Visibility API and AbortController.
 * Automatically halts when user leaves tab/minimizes window and resumes immediately on return.
 * Time complexity: O(1) interval setup/cleanup.
 */
export function usePolling(
  callback: (signal: AbortSignal) => Promise<void> | void,
  intervalMs: number,
  enabled: boolean = true,
): void {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let abortController = new AbortController();
    let timerId: ReturnType<typeof setInterval> | null = null;
    let isExecuting = false;

    const execute = async () => {
      if (document.hidden) return;
      if (isExecuting) return;

      isExecuting = true;
      abortController = new AbortController();
      try {
        await savedCallback.current(abortController.signal);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          // In production, unexpected polling errors can be logged or suppressed
        }
      } finally {
        isExecuting = false;
      }
    };

    // Initial immediate fetch
    void execute();

    timerId = setInterval(() => {
      void execute();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible again: execute immediately
        void execute();
      } else {
        // Tab hidden: cancel any pending request
        abortController.abort();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerId) clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      abortController.abort();
    };
  }, [intervalMs, enabled]);
}
