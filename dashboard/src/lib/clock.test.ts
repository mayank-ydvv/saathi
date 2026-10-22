import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../config";
import { now, resetServerClock, syncServerClock } from "./clock";

describe("real-mode clock", () => {
  beforeEach(() => {
    config.useMock = false;
    resetServerClock();
  });
  afterEach(() => {
    config.useMock = true;
    resetServerClock();
  });

  it("follows the backend's demo clock when /_dev/clock exists", async () => {
    const demo = "2026-10-22T04:50:00Z"; // 10:20 IST, as fall_day sets it
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ now: demo }), { status: 200 })),
    );
    expect(await syncServerClock()).toBe(true);
    expect(Math.abs(now().getTime() - Date.parse(demo))).toBeLessThan(2_000);
  });

  it("uses device time when the backend has no demo clock", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
    expect(await syncServerClock()).toBe(false);
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(50);
  });
});
