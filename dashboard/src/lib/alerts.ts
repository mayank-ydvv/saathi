import type { Alert } from "../api/types";
import { formatDuration, minutesBetween } from "./time";

export const isOpen = (a: Alert) => a.state !== "RESOLVED";

/** "Resolved by Priya in 6 min" (from the alert starting to the ack), or null while open. */
export function resolvedSummary(a: Alert): string | null {
  if (a.state !== "RESOLVED" || !a.resolved_at) return null;
  const who = a.acked_by?.name ? `by ${a.acked_by.name} ` : "";
  return `Resolved ${who}in ${formatDuration(minutesBetween(a.created_at, a.resolved_at))}`;
}

/** Who acknowledged, in words: "Priya (family)". */
export function ackedByLabel(a: Alert): string | null {
  if (!a.acked_by) return null;
  return `${a.acked_by.name} (${a.acked_by.by})`;
}
