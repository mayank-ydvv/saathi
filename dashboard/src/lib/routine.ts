/** Routine helpers. */
import type { RoutineZone } from "../api/types";

export const slotTime = (slot: number) =>
  `${String(Math.floor(slot / 4)).padStart(2, "0")}:${String((slot % 4) * 15).padStart(2, "0")}`;

/** Busiest few slots as words, for the chart's text alternative. O(96 log 96). */
export function peaks(hist: number[]): string {
  const top = hist
    .map((count, slot) => ({ count, slot }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count || a.slot - b.slot)
    .slice(0, 3)
    .sort((a, b) => a.slot - b.slot)
    .map(({ slot }) => slotTime(slot));
  return top.length ? `most active around ${top.join(", ")}` : "no activity learned yet";
}

/** Per hour, the share of learned days (0–100) the zone was busy in its busiest 15 minutes. */
export function hourShares(zone: RoutineZone): number[] {
  const days = Math.max(1, zone.days_seen);
  return Array.from({ length: 24 }, (_, hour) => {
    const slots = zone.hist.slice(hour * 4, hour * 4 + 4);
    return Math.min(100, Math.round((Math.max(0, ...slots) / days) * 100));
  });
}

export interface RoutineInsights {
  /** Earliest usual first activity across rooms ("06:45"), or null before anything is learned. */
  upBy: string | null;
  /** The hour the home is busiest, summed over rooms (0–23), or null. */
  busiestHour: number | null;
  /** The room with the most activity overall, or null. */
  busiestZone: string | null;
  /** Fewest days any room has learned from (the routine is complete at 14). */
  daysLearned: number;
}

/** Plain-language highlights for the Routine page. O(96 × zones). */
export function insights(zones: RoutineZone[]): RoutineInsights {
  const firsts = zones.map((z) => z.usual_first).filter((t): t is string => t !== null).sort();
  const totals = new Array<number>(24).fill(0);
  let busiestZone: string | null = null;
  let busiestSum = 0;
  for (const z of zones) {
    hourShares(z).forEach((pct, hour) => (totals[hour] = (totals[hour] ?? 0) + pct));
    const sum = z.hist.reduce((a, b) => a + b, 0);
    if (sum > busiestSum) [busiestZone, busiestSum] = [z.zone, sum];
  }
  const peak = Math.max(...totals);
  return {
    upBy: firsts[0] ?? null,
    busiestHour: peak > 0 ? totals.indexOf(peak) : null,
    busiestZone,
    daysLearned: zones.length ? Math.min(...zones.map((z) => z.days_seen)) : 0,
  };
}
