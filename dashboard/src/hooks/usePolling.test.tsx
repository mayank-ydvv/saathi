import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Result } from "../api/client";
import { usePolling } from "./usePolling";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePolling", () => {
  it("polls while visible, pauses while hidden and refetches when shown again", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    let n = 0;
    const fetcher = vi.fn(async (): Promise<Result<number>> => ({ ok: true, data: ++n }));
    const { result } = renderHook(() => usePolling(fetcher, 5_000));

    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.data).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(result.current.data).toBe(2);

    act(() => setVisibility("hidden"));
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(fetcher).toHaveBeenCalledTimes(2);

    await act(async () => setVisibility("visible"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.data).toBe(3);
  });

  it("aborts the previous request when a new one starts, and keeps data on error", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const signals: AbortSignal[] = [];
    const answers: Result<string>[] = [
      { ok: true, data: "first" },
      { ok: false, error: { kind: "network", message: "offline" } },
    ];
    const fetcher = vi.fn(async (signal: AbortSignal): Promise<Result<string>> => {
      signals.push(signal);
      return answers.shift() ?? { ok: true, data: "later" };
    });
    const { result } = renderHook(() => usePolling(fetcher, null));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.data).toBe("first");

    await act(async () => result.current.refresh());
    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.data).toBe("first");
    expect(result.current.error?.kind).toBe("network");
  });
});
