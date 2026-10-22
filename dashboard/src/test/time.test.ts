import { describe, expect, it } from "vitest";
import {
  formatDurationBetween,
  formatLocalDate,
  formatLocalTime,
  formatLocalTime24,
  formatRelativeTime,
  getMinuteOfDayInKolkata,
  slotIndexToTime,
} from "../utils/time";

describe("Time utilities (Asia/Kolkata)", () => {
  it("formats UTC timestamp to 12-hour local time in Asia/Kolkata", () => {
    // 02:35 UTC is 08:05 IST
    const utcIso = "2026-10-22T02:35:00Z";
    const formatted = formatLocalTime(utcIso);
    expect(formatted).toMatch(/08:05\s*(AM|am)/i);
  });

  it("formats UTC timestamp to 24-hour local time in Asia/Kolkata", () => {
    // 02:35 UTC is 08:05 IST
    const utcIso = "2026-10-22T02:35:00Z";
    const formatted = formatLocalTime24(utcIso);
    expect(formatted).toBe("08:05");
  });

  it("formats readable date in Asia/Kolkata", () => {
    const utcIso = "2026-10-22T02:35:00Z";
    const formatted = formatLocalDate(utcIso);
    expect(formatted).toContain("22");
    expect(formatted).toContain("Oct");
    expect(formatted).toContain("2026");
  });

  it("computes relative time correctly", () => {
    const baseNow = new Date("2026-10-22T06:00:00Z");

    // 12 minutes earlier
    const twelveMinAgo = "2026-10-22T05:48:00Z";
    expect(formatRelativeTime(twelveMinAgo, baseNow)).toBe("12 min ago");

    // 30 seconds earlier
    const thirtySecAgo = "2026-10-22T05:59:30Z";
    expect(formatRelativeTime(thirtySecAgo, baseNow)).toBe("just now");

    // 2 hours earlier
    const twoHoursAgo = "2026-10-22T04:00:00Z";
    expect(formatRelativeTime(twoHoursAgo, baseNow)).toBe("2 hr ago");
  });

  it("calculates step duration between two timestamps", () => {
    const start = "2026-10-22T04:45:00Z";
    const end = "2026-10-22T04:51:00Z";
    expect(formatDurationBetween(start, end)).toBe("6 min");
  });

  it("calculates minute of day in Asia/Kolkata", () => {
    // 02:30 UTC is 08:00 IST -> 8 * 60 = 480 minutes
    const utcIso = "2026-10-22T02:30:00Z";
    expect(getMinuteOfDayInKolkata(utcIso)).toBe(480);
  });

  it("converts slot index to HH:MM time", () => {
    expect(slotIndexToTime(0)).toBe("00:00");
    expect(slotIndexToTime(32)).toBe("08:00");
    expect(slotIndexToTime(95)).toBe("23:45");
  });
});
