/** Time helpers. Every user-facing time is shown in Asia/Kolkata (contract 4.1). */

export const TIMEZONE = "Asia/Kolkata";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dateKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const longDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

function toDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** "08:05" in IST. */
export function formatTimeIST(value: string | Date): string {
  return timeFmt.format(toDate(value));
}

/** "Thursday, 22 October" in IST. */
export function formatDateIST(value: string | Date): string {
  return longDateFmt.format(toDate(value));
}

/** The IST calendar date of `value` as "YYYY-MM-DD" (the API's `date` parameter). */
export function dateKeyIST(value: string | Date): string {
  return dateKeyFmt.format(toDate(value));
}

/** Today's IST date as "YYYY-MM-DD". */
export function todayIST(now: Date = new Date()): string {
  return dateKeyIST(now);
}

/** Minutes after IST midnight (0..1439). */
export function minuteOfDayIST(value: string | Date): number {
  const [h, m] = formatTimeIST(value).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** The UTC instant of IST `date` ("YYYY-MM-DD") at `hhmm` ("HH:MM"). IST has no DST. */
export function istToUtc(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00+05:30`);
}

/** "YYYY-MM-DD" shifted by `days` (calendar arithmetic, timezone independent). */
export function shiftDateKey(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole minutes from `from` to `to` (never negative). */
export function minutesBetween(from: string | Date, to: string | Date): number {
  return Math.max(0, Math.floor((toDate(to).getTime() - toDate(from).getTime()) / 60_000));
}

/** "just now", "12 min ago", "3 h 5 min ago", "2 days ago". */
export function timeAgo(value: string | Date, now: Date = new Date()): string {
  const mins = minutesBetween(value, now);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return mins % 60 ? `${hours} h ${mins % 60} min ago` : `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** "6 min", "1 h 20 min": a duration for "Resolved by Priya in …". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return minutes % 60 ? `${h} h ${minutes % 60} min` : `${h} h`;
}

/** Same ISO string format the backend sends: second precision, trailing "Z". */
export function toIsoZ(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}
