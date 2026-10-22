import type { TimelineEvent } from "../api/types";
import { minuteOfDayIST } from "./time";

export const ZONE_ORDER = ["front_door", "kitchen", "living_room", "bedroom"] as const;

export interface Lane {
  zone: string;
  events: TimelineEvent[];
}

/**
 * Group events into one lane per zone in a single pass: O(n) for n events (the API already
 * sorts by ts, so each lane stays sorted). Events for zones not in `zones` are dropped.
 */
export function groupIntoLanes(events: TimelineEvent[], zones: readonly string[] = ZONE_ORDER): Lane[] {
  const lanes = new Map<string, TimelineEvent[]>(zones.map((z) => [z, []]));
  for (const e of events) lanes.get(e.zone)?.push(e);
  return zones.map((zone) => ({ zone, events: lanes.get(zone) ?? [] }));
}

/** Horizontal position of a time on a 00:00–24:00 axis, in percent. */
export function dayPercent(value: string | Date): number {
  return (minuteOfDayIST(value) / (24 * 60)) * 100;
}

/** A doorbell event with a snapshot or a visitor description opens the visitor panel. */
export function isVisitorEvent(e: TimelineEvent): boolean {
  return e.type === "ding" && (e.visitor !== null || e.snapshot_url !== null);
}
