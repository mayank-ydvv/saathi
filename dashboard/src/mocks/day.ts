/**
 * Kamala's day in Chennai as mock timeline events: 61 events over the four zones, including
 * two doorbell visitors (a courier, and an unknown man the vision check flags).
 * Times are IST; dates are filled in per request so "today" always has data.
 */
import type { TimelineEvent, Visitor } from "../api/types";
import { istToUtc, shiftDateKey, toIsoZ } from "../lib/time";
import { COURIER_SNAPSHOT, STRANGER_SNAPSHOT } from "./snapshots";

type Spec = [hhmm: string, zone: string, type: string, visitor?: Visitor, snapshot?: string];

const COURIER: Visitor = {
  summary: "One person in a delivery uniform holding a cardboard box.",
  person_count: 1,
  uniform_or_badge: true,
  carrying_package: true,
  caution: false,
  caution_reason: "",
};

const STRANGER: Visitor = {
  summary: "One man at the door, no uniform or badge visible, nothing in his hands.",
  person_count: 1,
  uniform_or_badge: false,
  carrying_package: false,
  caution: true,
  caution_reason: "No uniform, badge or package visible",
};

const zoneTimes = (zone: string, times: string[], type = "motion.human"): Spec[] =>
  times.map((t) => [t, zone, type]);

/** A normal day (61 events). */
export const DAY: readonly Spec[] = [
  ...zoneTimes("bedroom", ["06:42", "06:47", "06:55", "07:01", "13:35", "13:41"]),
  ...zoneTimes("bedroom", ["14:30", "14:38", "21:20", "21:28", "21:41", "21:52"]),
  ...zoneTimes("kitchen", ["07:38", "07:44", "07:52", "08:03", "08:11", "10:30"]),
  ...zoneTimes("kitchen", ["12:05", "12:14", "12:26", "12:38", "16:15", "16:22"]),
  ...zoneTimes("kitchen", ["19:05", "19:14", "19:26", "19:40", "19:52", "20:10"]),
  ...zoneTimes("living_room", ["08:25", "08:40", "09:05", "09:30", "10:05", "10:50"]),
  ...zoneTimes("living_room", ["11:10", "11:35", "15:00", "15:20", "15:45", "16:40"]),
  ...zoneTimes("living_room", ["17:05", "17:30", "18:00", "18:25", "18:50", "20:25"]),
  ...zoneTimes("living_room", ["20:45", "21:05"]),
  ["07:05", "front_door", "motion.human"],
  ["07:06", "front_door", "motion"],
  ["09:50", "front_door", "vehicle"],
  ["11:20", "front_door", "motion.human"],
  ["11:21", "front_door", "ding", COURIER, COURIER_SNAPSHOT],
  ["11:22", "front_door", "package"],
  ["15:08", "front_door", "motion.human"],
  ["15:10", "front_door", "ding", STRANGER, STRANGER_SNAPSHOT],
  ["15:12", "front_door", "motion.human"],
  ["18:10", "front_door", "motion.human"],
  ["18:55", "front_door", "motion.human"],
];

/** Yesterday Kamala slept in: no kitchen before 09:02 (the resolved late-start alert). */
function sleptIn(specs: readonly Spec[]): Spec[] {
  const late = specs.filter(([t, zone]) => !(zone === "kitchen" && t < "09:00"));
  return [...late, ["09:02", "kitchen", "motion.human"]];
}

/** Events for IST `date`, up to `cutoff` (exclusive), sorted by time. O(n log n). */
export function eventsFor(date: string, today: string, cutoff: Date): TimelineEvent[] {
  if (date > today) return [];
  const specs = date === shiftDateKey(today, -1) ? sleptIn(DAY) : DAY;
  return specs
    .map(([hhmm, zone, type, visitor, snapshot], i) => ({
      event_id: `evt_mock_${date.replaceAll("-", "")}_${String(i).padStart(3, "0")}`,
      ts: toIsoZ(istToUtc(date, hhmm)),
      zone,
      type,
      snapshot_url: snapshot ?? null,
      visitor: visitor ?? null,
    }))
    .filter((e) => new Date(e.ts) < cutoff)
    .sort((a, b) => a.ts.localeCompare(b.ts));
}
