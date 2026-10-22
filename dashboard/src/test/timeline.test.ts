import { describe, expect, it } from "vitest";
import mockTimelineData from "../mocks/timeline.json";
import type { TimelineEvent } from "../api/types";

describe("Timeline grouping and visitor details", () => {
  it("groups events into zone lanes in an O(n) pass", () => {
    const events = mockTimelineData.events as TimelineEvent[];
    expect(events.length).toBeGreaterThan(50);

    const grouped: Record<string, TimelineEvent[]> = {
      front_door: [],
      kitchen: [],
      living_room: [],
      bedroom: [],
    };

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev && grouped[ev.zone]) {
        grouped[ev.zone]?.push(ev);
      }
    }

    expect(grouped.kitchen?.length).toBeGreaterThan(10);
    expect(grouped.bedroom?.length).toBeGreaterThan(10);
    expect(grouped.living_room?.length).toBeGreaterThan(10);
    expect(grouped.front_door?.length).toBeGreaterThan(5);
  });

  it("identifies caution flags for unknown visitors at the front door", () => {
    const events = mockTimelineData.events as TimelineEvent[];
    const cautionEvents = events.filter((e) => e.visitor?.caution === true);
    expect(cautionEvents.length).toBe(1);
    expect(cautionEvents[0]?.zone).toBe("front_door");
    expect(cautionEvents[0]?.visitor?.caution_reason).toContain("Unrecognized");
  });

  it("identifies authorized visitors like milk delivery and parcel courier", () => {
    const events = mockTimelineData.events as TimelineEvent[];
    const regularVisitors = events.filter((e) => e.visitor?.uniform_or_badge === true);
    expect(regularVisitors.length).toBe(2);
    expect(regularVisitors.some((e) => e.visitor?.summary.includes("milk"))).toBe(true);
    expect(regularVisitors.some((e) => e.visitor?.summary.includes("Courier") || e.visitor?.summary.includes("Amazon"))).toBe(true);
  });
});
