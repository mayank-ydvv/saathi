import { describe, expect, it } from "vitest";
import type { Alert, TimelineEvent } from "../api/types";
import { resolvedSummary } from "./alerts";
import { kindLabel, statusLook, stepLabel, zoneLabel } from "./labels";
import { peaks } from "./routine";
import { dayPercent, groupIntoLanes, isVisitorEvent } from "./timeline";

const ev = (id: string, zone: string, ts: string, type = "motion.human"): TimelineEvent => ({
  event_id: id,
  ts,
  zone,
  type,
  snapshot_url: null,
  visitor: null,
});

describe("timeline lanes", () => {
  it("groups events by zone in contract order, keeping each lane sorted", () => {
    const events = [
      ev("1", "kitchen", "2026-10-22T02:05:00Z"),
      ev("2", "bedroom", "2026-10-22T02:10:00Z"),
      ev("3", "kitchen", "2026-10-22T03:00:00Z"),
      ev("4", "garage", "2026-10-22T03:05:00Z"),
    ];
    const lanes = groupIntoLanes(events);
    expect(lanes.map((l) => l.zone)).toEqual(["front_door", "kitchen", "living_room", "bedroom"]);
    expect(lanes[1]?.events.map((e) => e.event_id)).toEqual(["1", "3"]);
    expect(lanes[3]?.events.map((e) => e.event_id)).toEqual(["2"]);
    expect(lanes.flatMap((l) => l.events)).toHaveLength(3); // unknown zone dropped
  });

  it("follows the home's zone list when given", () => {
    expect(groupIntoLanes([], ["kitchen"]).map((l) => l.zone)).toEqual(["kitchen"]);
  });

  it("places times on a 24 h axis in IST", () => {
    expect(dayPercent("2026-10-21T18:30:00Z")).toBe(0); // 00:00 IST
    expect(dayPercent("2026-10-22T06:30:00Z")).toBe(50); // 12:00 IST
  });

  it("only doorbell events with a snapshot or visitor open the panel", () => {
    expect(isVisitorEvent(ev("1", "front_door", "2026-10-22T05:00:00Z", "ding"))).toBe(false);
    expect(isVisitorEvent({ ...ev("2", "front_door", "x", "ding"), snapshot_url: "data:," })).toBe(true);
    expect(isVisitorEvent({ ...ev("3", "kitchen", "x"), snapshot_url: "data:," })).toBe(false);
  });
});

describe("status mapping", () => {
  it.each([
    ["green", "All normal", "check"],
    ["yellow", "Checking in", "clock"],
    ["red", "Needs attention", "alert"],
  ])("%s → %s with a %s icon", (colour, label, icon) => {
    const look = statusLook(colour);
    expect(look.label).toBe(label);
    expect(look.icon).toBe(icon);
    expect(look.tone).toMatch(/^bg-\w+-bg text-\w+-ink$/);
  });

  it("treats an unknown colour as 'checking in' rather than 'all normal'", () => {
    expect(statusLook("purple").label).toBe("Checking in");
  });

  it("labels zones, kinds and steps", () => {
    expect(zoneLabel("living_room")).toBe("Living room");
    expect(zoneLabel("garden_shed")).toBe("Garden shed");
    expect(kindLabel("long_inactivity")).toBe("Long quiet spell");
    expect(stepLabel("NUDGE_PARENT", "Kamala")).toBe("Asked Kamala");
    expect(stepLabel("ALERT_FAMILY")).toBe("Alerted family");
  });
});

describe("alert summary", () => {
  const base: Alert = {
    alert_id: "a",
    home_id: "home-demo-1",
    kind: "late_start",
    zone: "kitchen",
    reason: "r",
    state: "RESOLVED",
    created_at: "2026-10-22T03:05:00Z",
    resolved_at: "2026-10-22T03:11:00Z",
    acked_by: { by: "family", name: "Priya" },
    steps: [],
  };

  it("says who resolved it and how long it took", () => {
    expect(resolvedSummary(base)).toBe("Resolved by Priya in 6 min");
    expect(resolvedSummary({ ...base, resolved_at: "2026-10-22T04:25:00Z" })).toBe(
      "Resolved by Priya in 1 h 20 min",
    );
  });

  it("says 'under a minute' for demo-speed acks", () => {
    expect(resolvedSummary({ ...base, resolved_at: "2026-10-22T03:05:30Z" })).toBe(
      "Resolved by Priya in under a minute",
    );
  });

  it("is null while the alert is open", () => {
    expect(resolvedSummary({ ...base, state: "ALERT_FAMILY", resolved_at: null })).toBeNull();
  });
});

describe("routine text", () => {
  it("names the three busiest slots in time order", () => {
    const hist = new Array<number>(96).fill(0);
    hist[30] = 14; // 07:30
    hist[48] = 12; // 12:00
    hist[78] = 13; // 19:30
    hist[10] = 1;
    expect(peaks(hist)).toBe("most active around 07:30, 12:00, 19:30");
    expect(peaks(new Array<number>(96).fill(0))).toBe("no activity learned yet");
  });
});
