import type { Alert } from "../api/types";
import { formatDuration, minutesBetween } from "./time";

export const isOpen = (a: Alert) => a.state !== "RESOLVED";

/** "Resolved by Priya in 6 min" (from the alert starting to the ack), or null while open. */
export function resolvedSummary(a: Alert): string | null {
  if (a.state !== "RESOLVED" || !a.resolved_at) return null;
  const who = a.acked_by?.name ? `by ${a.acked_by.name} ` : "";
  const mins = minutesBetween(a.created_at, a.resolved_at);
  return `Resolved ${who}in ${mins < 1 ? "under a minute" : formatDuration(mins)}`;
}
