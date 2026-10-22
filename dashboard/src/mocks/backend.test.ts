import { describe, expect, it } from "vitest";
import type { Result } from "../api/client";
import { now, storyTime } from "../lib/clock";
import { formatTimeIST } from "../lib/time";
import { createMockBackend } from "./backend";
import { DAY } from "./day";
import { mockVariant } from "./variant";

// 16:30 IST: late enough in the day for every mock story to have happened.
const NOW = new Date("2026-10-22T11:00:00Z");
const clock = () => NOW;

function data<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error.message);
  return r.data;
}

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}

describe("story clock", () => {
  it("reads ?time=HH:MM and ignores invalid values", () => {
    expect(storyTime("?time=21:30")).toBe("21:30");
    expect(storyTime("?time=25:00")).toBe("16:30");
    expect(storyTime("")).toBe("16:30");
  });

  it("starts the mock day at the story time, in IST", () => {
    expect(formatTimeIST(now())).toBe("16:30");
  });
});

describe("mock switcher", () => {
  it("reads ?mock=green|yellow|red and defaults to red", () => {
    expect(mockVariant("?mock=green")).toBe("green");
    expect(mockVariant("?mock=yellow")).toBe("yellow");
    expect(mockVariant("?mock=red")).toBe("red");
    expect(mockVariant("")).toBe("red");
    expect(mockVariant("?mock=purple")).toBe("red");
  });
});

describe("mock backend", () => {
  it("has ~60 events across the four zones", () => {
    expect(DAY.length).toBeGreaterThanOrEqual(55);
    expect(new Set(DAY.map(([, zone]) => zone))).toEqual(
      new Set(["front_door", "kitchen", "living_room", "bedroom"]),
    );
  });

  it.each([
    ["green", "green", null],
    ["yellow", "yellow", "NUDGE_PARENT"],
    ["red", "red", "ALERT_FAMILY"],
  ] as const)("variant %s → status %s", (variant, colour, openState) => {
    const api = createMockBackend(variant, clock);
    const status = data(api.status());
    expect(status.status).toBe(colour);
    const alerts = data(api.alerts(20)).alerts;
    const open = alerts.find((a) => a.state !== "RESOLVED");
    expect(open?.state ?? null).toBe(openState);
    expect(status.active_alert_id).toBe(open?.alert_id ?? null);
  });

  it("keeps the timeline sorted and quiet before a red alert", () => {
    const api = createMockBackend("red", clock);
    const events = data(api.timeline("2026-10-22")).events;
    const ts = events.map((e) => e.ts);
    expect(ts).toEqual([...ts].sort());
    const last = must(events.at(-1));
    expect(NOW.getTime() - new Date(last.ts).getTime()).toBeGreaterThan(4 * 3_600_000);
    expect(data(api.status()).last_seen).toEqual({ zone: last.zone, ts: last.ts });
  });

  it("includes a resolved late start with every step, newest alert first", () => {
    const alerts = data(createMockBackend("red", clock).alerts(20)).alerts;
    expect(alerts[0]?.state).toBe("ALERT_FAMILY");
    const late = must(alerts.find((a) => a.kind === "late_start" && a.state === "RESOLVED"));
    expect(late.steps.map((s) => s.state)).toEqual([
      "SUSPECT",
      "NUDGE_PARENT",
      "ALERT_FAMILY",
      "RESOLVED",
    ]);
    expect(late.acked_by).toEqual({ by: "family", name: "Priya" });
  });

  it("ack resolves the open alert and the status turns green", () => {
    const api = createMockBackend("red", clock);
    const id = must(data(api.status()).active_alert_id);
    expect(data(api.ack(id, { by: "family", name: "Priya" }))).toEqual({
      alert_id: id,
      state: "RESOLVED",
    });
    expect(data(api.status()).status).toBe("green");
    const acked = must(data(api.alerts(20)).alerts.find((a) => a.alert_id === id));
    expect(acked.acked_by).toEqual({ by: "family", name: "Priya" });
    expect(acked.steps.at(-1)?.state).toBe("RESOLVED");
    expect(data(api.nudge()).active).toBe(false);
  });

  it("returns not_found for unknown alerts and missing digests", () => {
    const api = createMockBackend("green", clock);
    const ack = api.ack("alt_nope", { by: "family", name: "P" });
    expect(!ack.ok && ack.error.kind).toBe("not_found");
    const today = api.digest("2026-10-22"); // before 21:00 IST
    expect(!today.ok && today.error.kind).toBe("not_found");
    expect(data(api.digest("2026-10-21")).text).toMatch(/Kamala/);
  });

  it("routine has 96 slots per zone and a usual first time", () => {
    const zones = data(createMockBackend("green", clock).routine()).zones;
    expect(zones).toHaveLength(4);
    for (const z of zones) {
      expect(z.hist).toHaveLength(96);
      expect(z.usual_first).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it("the nudge is active while the parent is being asked", () => {
    expect(data(createMockBackend("yellow", clock).nudge()).active).toBe(true);
    expect(data(createMockBackend("green", clock).nudge()).active).toBe(false);
  });
});
