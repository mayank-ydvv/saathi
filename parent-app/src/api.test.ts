import { describe, expect, it, vi } from "vitest";
import { createHttpApi, createMockApi } from "./api";

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe("createHttpApi", () => {
  it("polls GET /homes/{id}/nudge", async () => {
    const fetchFn = vi.fn(() => ok({ active: false, alert_id: null, message: null, audio_url: null }));
    const api = createHttpApi("http://api.test", "home-demo-1", fetchFn);
    await api.getNudge();
    expect(fetchFn).toHaveBeenCalledWith("http://api.test/homes/home-demo-1/nudge");
  });

  it("acknowledges with POST /alerts/{id}/ack and the parent body from the contract", async () => {
    const fetchFn = vi.fn<typeof fetch>(() => ok({ alert_id: "alt_1", state: "RESOLVED" }));
    const api = createHttpApi("http://api.test", "home-demo-1", fetchFn);
    await api.ack("alt_1", "Kamala");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test/alerts/alt_1/ack");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ by: "parent", name: "Kamala" });
  });

  it("throws on an error status so the app can ask again", async () => {
    const fetchFn = vi.fn(() => Promise.resolve(new Response("{}", { status: 404 })));
    const api = createHttpApi("http://api.test", "home-demo-1", fetchFn);
    await expect(api.ack("missing", "Kamala")).rejects.toThrow("HTTP 404");
  });
});

describe("createMockApi", () => {
  it("activates one nudge after the delay and clears it on ack", async () => {
    let now = 0;
    const api = createMockApi(10_000, () => now);
    expect((await api.getNudge()).active).toBe(false);
    now = 10_000;
    const nudge = await api.getNudge();
    expect(nudge).toMatchObject({ active: true, alert_id: "alt_mock", audio_url: null });
    await api.ack("alt_mock", "Kamala");
    expect((await api.getNudge()).active).toBe(false);
  });
});
