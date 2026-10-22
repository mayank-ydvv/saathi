/** Mock routine histograms and evening digests. */
import type { Digest, Routine, RoutineZone } from "../api/types";
import { istToUtc, shiftDateKey, toIsoZ } from "../lib/time";
import { DAY } from "./day";

const DAYS = 14;
const USUAL_FIRST: Record<string, string> = {
  front_door: "07:05",
  kitchen: "07:40",
  living_room: "08:25",
  bedroom: "06:45",
};

const slotOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return Math.floor(((h ?? 0) * 60 + (m ?? 0)) / 15);
};

/** 96-slot counts of active days: the usual slot most days, a neighbour now and then. */
function histFor(zone: string): number[] {
  const hist = new Array<number>(96).fill(0);
  for (const [hhmm, z] of DAY) {
    if (z !== zone) continue;
    const s = slotOf(hhmm);
    hist[s] = Math.max(hist[s] ?? 0, 11 + (s % 4));
    if (s > 0) hist[s - 1] = Math.max(hist[s - 1] ?? 0, 2 + (s % 3));
    if (s < 95) hist[s + 1] = Math.max(hist[s + 1] ?? 0, 3 + (s % 2));
  }
  return hist.map((n) => Math.min(n, DAYS));
}

export function routine(): Routine {
  const zones: RoutineZone[] = Object.keys(USUAL_FIRST).map((zone) => ({
    zone,
    usual_first: USUAL_FIRST[zone] ?? null,
    hist: histFor(zone),
    days_seen: DAYS,
  }));
  return { zones };
}

const NORMAL =
  "Kamala had a calm, steady day. She was up a little before 7, and the milk was in by 7:05. " +
  "Breakfast was around 7:40, lunch just after noon and dinner around 7 pm, so she kept to " +
  "her usual meals. A courier delivered a parcel at 11:20. She spent most of the afternoon in " +
  "the living room with a short rest after lunch, and went out briefly in the evening. " +
  "Everything looked like a normal day for her, nothing to worry about tonight.";

const LATE =
  "Kamala started her day later than usual. There was no kitchen movement by 8:35, so Saathi " +
  "checked in; Priya called and confirmed she was fine, and the alert was resolved at 8:51. " +
  "Breakfast was around 9, lunch just after noon and dinner around 7 pm. A courier came by " +
  "at 11:20 and she rested after lunch. The rest of the day followed her normal rhythm. " +
  "Since mornings were slow today, a quick call tomorrow morning might be reassuring.";

/** Digests exist for the last 6 days, and for today only after 21:00 IST (when it's sent). */
export function digest(date: string, today: string, now: Date): Digest | null {
  const generated = istToUtc(date, "21:00");
  if (date > today || date < shiftDateKey(today, -6) || generated > now) return null;
  const text = date === shiftDateKey(today, -1) ? LATE : NORMAL;
  return { date, text, generated_at: toIsoZ(generated) };
}
