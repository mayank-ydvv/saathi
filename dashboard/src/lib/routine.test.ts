import { describe, expect, it } from "vitest";
import type { RoutineZone } from "../api/types";
import { hourShares, insights } from "./routine";

function zone(name: string, usual: string | null, busy: Record<number, number>, days = 14): RoutineZone {
  const hist = new Array<number>(96).fill(0);
  for (const [slot, count] of Object.entries(busy)) hist[Number(slot)] = count;
  return { zone: name, usual_first: usual, hist, days_seen: days };
}

describe("routine insights", () => {
  it("hourShares takes the busiest quarter of each hour as a share of the days", () => {
    const shares = hourShares(zone("kitchen", "07:40", { 30: 7, 31: 14, 32: 2 }));
    expect(shares[7]).toBe(100); // slots 28–31
    expect(shares[8]).toBe(14); // slot 32: 2 of 14 days
    expect(shares[0]).toBe(0);
  });

  it("finds the earliest usual time, the busiest hour and room, and the fewest days learned", () => {
    const facts = insights([
      zone("kitchen", "07:40", { 31: 14, 48: 10 }),
      zone("bedroom", "06:45", { 27: 6 }, 9),
      zone("front_door", null, {}),
    ]);
    expect(facts).toEqual({ upBy: "06:45", busiestHour: 7, busiestZone: "kitchen", daysLearned: 9 });
  });

  it("is empty before anything is learned", () => {
    expect(insights([])).toEqual({ upBy: null, busiestHour: null, busiestZone: null, daysLearned: 0 });
  });
});
