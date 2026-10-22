/** Human words for API values. Unknown values fall back to a readable version of themselves. */
import type { AlertState, StatusColour } from "../api/types";

const ZONES: Record<string, string> = {
  front_door: "Front door",
  kitchen: "Kitchen",
  living_room: "Living room",
  bedroom: "Bedroom",
};

const EVENT_TYPES: Record<string, string> = {
  "motion.human": "Person seen",
  motion: "Motion",
  ding: "Doorbell",
  package: "Package",
  vehicle: "Vehicle",
};

const KINDS: Record<string, string> = {
  late_start: "Late start",
  long_inactivity: "Long quiet spell",
  night_activity: "Night activity",
};

const STEPS: Record<AlertState, string> = {
  SUSPECT: "Noticed something unusual",
  NUDGE_PARENT: "Asked the parent",
  ALERT_FAMILY: "Alerted family",
  ALERT_NEIGHBOUR: "Alerted neighbour",
  RESOLVED: "Resolved",
};

const humanize = (value: string) => {
  const words = value.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const zoneLabel = (zone: string) => ZONES[zone] ?? humanize(zone);
export const eventTypeLabel = (type: string) => EVENT_TYPES[type] ?? humanize(type);
export const kindLabel = (kind: string) => KINDS[kind] ?? humanize(kind);
export const stepLabel = (state: AlertState, parentName?: string) =>
  state === "NUDGE_PARENT" && parentName ? `Asked ${parentName}` : STEPS[state] ?? humanize(state);

export interface StatusLook {
  label: string;
  icon: "check" | "clock" | "alert";
  /** Tailwind classes: card background + text colour. */
  tone: string;
  dot: string;
}

/** Contract 4.4 colour → word, icon and colours. Colour is never the only signal. */
export const STATUS_LOOK: Record<StatusColour, StatusLook> = {
  green: { label: "All normal", icon: "check", tone: "bg-ok-bg text-ok-ink", dot: "bg-ok-dot" },
  yellow: { label: "Checking in", icon: "clock", tone: "bg-warn-bg text-warn-ink", dot: "bg-warn-dot" },
  red: { label: "Needs attention", icon: "alert", tone: "bg-bad-bg text-bad-ink", dot: "bg-bad-dot" },
};

export function statusLook(colour: string): StatusLook {
  return STATUS_LOOK[colour as StatusColour] ?? STATUS_LOOK.yellow;
}
