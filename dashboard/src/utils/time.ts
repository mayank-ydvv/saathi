/**
 * Time and Timezone utilities for Saathi.
 * All user-facing times are computed in 'Asia/Kolkata' (contract 4.1).
 */

export const TIMEZONE = "Asia/Kolkata";

/**
 * Format UTC ISO string to 12-hour local time (e.g., "08:05 AM")
 * Time complexity: O(1)
 */
export function formatLocalTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "--:--";
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return "--:--";
  }
}

/**
 * Format UTC ISO string to short 24-hour time (e.g., "08:05")
 * Time complexity: O(1)
 */
export function formatLocalTime24(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "--:--";
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return "--:--";
  }
}

/**
 * Format UTC ISO string to readable date (e.g. "22 Oct 2026")
 * Time complexity: O(1)
 */
export function formatLocalDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: TIMEZONE,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

/**
 * Live ticking digital clock formatted for header (e.g. "11:30:45 AM")
 * Time complexity: O(1)
 */
export function formatLiveClock(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Return relative human time from ISO timestamp (e.g. "12 min ago", "2 hr ago", "just now")
 * Time complexity: O(1)
 */
export function formatRelativeTime(
  isoString: string,
  nowReference?: Date,
): string {
  try {
    const target = new Date(isoString).getTime();
    if (isNaN(target)) return "Unknown";
    const now = (nowReference || new Date()).getTime();
    const diffSec = Math.max(0, Math.floor((now - target) / 1000));

    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  } catch {
    return "Unknown";
  }
}

/**
 * Calculate difference in minutes between two ISO timestamps (e.g. "6 min")
 * Time complexity: O(1)
 */
export function formatDurationBetween(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (isNaN(start) || isNaN(end)) return "";
    const diffMin = Math.max(1, Math.round((end - start) / 60000));
    if (diffMin < 60) return `${diffMin} min`;
    const hrs = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  } catch {
    return "";
  }
}

/**
 * Get minute of day (0..1439) in Asia/Kolkata timezone from ISO string
 * Time complexity: O(1)
 */
export function getMinuteOfDayInKolkata(isoString: string): number {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 0;

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(d);

    let hour = 0;
    let minute = 0;
    for (const part of parts) {
      if (part.type === "hour") hour = parseInt(part.value, 10);
      if (part.type === "minute") minute = parseInt(part.value, 10);
    }
    // Intl hour in 24h might return 24 for midnight in some engines
    if (hour === 24) hour = 0;
    return hour * 60 + minute;
  } catch {
    return 0;
  }
}

/**
 * Convert slot index (0..95) to 24-hour "HH:MM" string
 * Time complexity: O(1)
 */
export function slotIndexToTime(slotIndex: number): string {
  const totalMinutes = Math.max(0, Math.min(95, slotIndex)) * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}
