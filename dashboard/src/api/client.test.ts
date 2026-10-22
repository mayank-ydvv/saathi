import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../config";
import { ackAlert, getDigest, getStatus, getTimeline } from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("real API client", () => {
  beforeEach(() => {
    config.useMock = false;
    config.apiBase = "http://api.test";
  });
  afterEach(() => {
    config.useMock = true;
  });

  it("calls the contract paths and returns data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { date: "2026-10-22", events: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await getTimeline("2026-10-22");
    expect(r).toEqual({ ok: true, data: { date: "2026-10-22", events: [] } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.test/homes/home-demo-1/timeline?date=2026-10-22",
    );
  });

  it("posts the ack body from the contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { alert_id: "a1", state: "RESOLVED" }));
    vi.stubGlobal("fetch", fetchMock);
    await ackAlert("a1", { by: "family", name: "Priya" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/alerts/a1/ack");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ by: "family", name: "Priya" });
  });

  it("maps 404 to not_found with the server's detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { detail: "no digest for that date" })));
    expect(await getDigest("2026-10-22")).toEqual({
      ok: false,
      error: { kind: "not_found", status: 404, message: "no digest for that date" },
    });
  });

  it("maps other HTTP errors and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, "oops")));
    const http = await getStatus();
    expect(!http.ok && http.error).toEqual({ kind: "http", status: 500, message: "HTTP 500" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const net = await getStatus();
    expect(!net.ok && net.error.kind).toBe("network");
  });

  it("reports aborted requests as aborted", async () => {
    const ctrl = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        ctrl.abort();
        return Promise.reject(new DOMException("aborted", "AbortError"));
      }),
    );
    const r = await getStatus({ signal: ctrl.signal });
    expect(!r.ok && r.error.kind).toBe("aborted");
  });
});

describe("mock client", () => {
  it("answers from mock data after a short delay, and can be cancelled", async () => {
    vi.useFakeTimers();
    const pending = getStatus();
    await vi.advanceTimersByTimeAsync(300);
    const r = await pending;
    expect(r.ok && r.data.home_id).toBe("home-demo-1");

    const ctrl = new AbortController();
    const cancelled = getStatus({ signal: ctrl.signal });
    ctrl.abort();
    expect(await cancelled).toEqual({
      ok: false,
      error: { kind: "aborted", message: "request cancelled" },
    });
  });
});
