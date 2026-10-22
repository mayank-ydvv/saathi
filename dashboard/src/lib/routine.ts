/** Routine helpers. */

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
