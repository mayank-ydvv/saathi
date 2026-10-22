import { beforeEach, describe, expect, it } from "vitest";
import {
  ackAlert,
  getAlerts,
  getDigest,
  getHealth,
  getHome,
  getRoutine,
  getStatus,
  getTimeline,
  setMockStatusOverride,
} from "../api/client";

describe("API Client in Mock Mode", () => {
  beforeEach(() => {
    setMockStatusOverride(null);
  });

  it("returns healthy response", async () => {
    const res = await getHealth();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.ok).toBe(true);
    }
  });

  it("fetches home details for Kamala in Chennai", async () => {
    const res = await getHome("home-demo-1");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.parent_name).toBe("Kamala");
      expect(res.data.city).toBe("Chennai");
      expect(res.data.zones).toEqual(["front_door", "kitchen", "living_room", "bedroom"]);
    }
  });

  it("defaults to green status when not overridden", async () => {
    const res = await getStatus("home-demo-1");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.status).toBe("green");
      expect(res.data.last_seen?.zone).toBe("kitchen");
    }
  });

  it("switches status with setMockStatusOverride", async () => {
    setMockStatusOverride("yellow");
    const yellowRes = await getStatus("home-demo-1");
    expect(yellowRes.success).toBe(true);
    if (yellowRes.success) {
      expect(yellowRes.data.status).toBe("yellow");
    }

    setMockStatusOverride("red");
    const redRes = await getStatus("home-demo-1");
    expect(redRes.success).toBe(true);
    if (redRes.success) {
      expect(redRes.data.status).toBe("red");
    }
  });

  it("fetches timeline events with visitor details", async () => {
    const res = await getTimeline("home-demo-1", "2026-10-22");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.events.length).toBeGreaterThanOrEqual(50);
      const doorbells = res.data.events.filter((e) => e.type === "ding");
      expect(doorbells.length).toBeGreaterThan(0);
      const cautionEvent = doorbells.find((e) => e.visitor?.caution === true);
      expect(cautionEvent).toBeDefined();
    }
  });

  it("fetches alerts list", async () => {
    const res = await getAlerts("home-demo-1");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.alerts.length).toBeGreaterThan(0);
    }
  });

  it("acknowledges an alert and marks it resolved", async () => {
    const res = await ackAlert("alt_demo_red", { by: "family", name: "Anushka" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.state).toBe("RESOLVED");
    }
  });

  it("fetches daily digest", async () => {
    const res = await getDigest("home-demo-1", "2026-10-22");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.text).toContain("Kamala");
      expect(res.data.text.split(/\s+/).length).toBeGreaterThanOrEqual(80);
    }
  });

  it("fetches routine data for all 4 zones", async () => {
    const res = await getRoutine("home-demo-1");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.zones.length).toBe(4);
      for (const z of res.data.zones) {
        expect(z.hist.length).toBe(96);
      }
    }
  });
});
