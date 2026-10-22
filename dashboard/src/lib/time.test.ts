import { describe, expect, it } from "vitest";
import {
  dateKeyIST,
  formatDuration,
  formatTimeIST,
  istToUtc,
  minuteOfDayIST,
  shiftDateKey,
  timeAgo,
  toIsoZ,
} from "./time";

describe("IST formatting", () => {
  it("shows UTC timestamps in Asia/Kolkata", () => {
    expect(formatTimeIST("2026-10-22T03:15:00Z")).toBe("08:45");
    expect(formatTimeIST("2026-10-21T18:30:00Z")).toBe("00:00");
  });

  it("uses the IST calendar date, not the UTC one", () => {
    expect(dateKeyIST("2026-10-21T18:29:59Z")).toBe("2026-10-21");
    expect(dateKeyIST("2026-10-21T18:30:00Z")).toBe("2026-10-22");
  });

  it("computes minutes after IST midnight", () => {
    expect(minuteOfDayIST("2026-10-22T03:15:00Z")).toBe(8 * 60 + 45);
    expect(minuteOfDayIST("2026-10-22T18:29:00Z")).toBe(23 * 60 + 59);
  });

  it("converts IST wall time to the UTC ISO string the API uses", () => {
    expect(toIsoZ(istToUtc("2026-10-22", "08:05"))).toBe("2026-10-22T02:35:00Z");
  });

  it("shifts dates across month ends", () => {
    expect(shiftDateKey("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("relative times", () => {
  const now = new Date("2026-10-22T10:00:00Z");

  it.each([
    ["2026-10-22T10:00:00Z", "just now"],
    ["2026-10-22T09:48:00Z", "12 min ago"],
    ["2026-10-22T08:55:00Z", "1 h 5 min ago"],
    ["2026-10-22T07:00:00Z", "3 h ago"],
    ["2026-10-20T09:00:00Z", "2 days ago"],
  ])("%s → %s", (ts, expected) => {
    expect(timeAgo(ts, now)).toBe(expected);
  });

  it("formats durations", () => {
    expect(formatDuration(6)).toBe("6 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(80)).toBe("1 h 20 min");
  });
});
