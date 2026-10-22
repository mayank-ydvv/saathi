/** Mock alert records (contract 4.4): one open alert (per variant) and two resolved ones. */
import type { Alert, AlertState, StatusColour, TimelineEvent } from "../api/types";
import { formatDuration, formatTimeIST, istToUtc, minutesBetween, shiftDateKey, toIsoZ } from "../lib/time";

const HOME = "home-demo-1";
const MIN = 60_000;

const at = (date: string, hhmm: string) => toIsoZ(istToUtc(date, hhmm));

/** Yesterday's late start: every step of the ladder, resolved by Priya 16 min after it began. */
export function resolvedLateStart(today: string): Alert {
  const d = shiftDateKey(today, -1);
  return {
    alert_id: "alt_mock_late_start",
    home_id: HOME,
    kind: "late_start",
    zone: "kitchen",
    reason: "No kitchen movement by 08:35 (usually 07:40)",
    state: "RESOLVED",
    created_at: at(d, "08:35"),
    resolved_at: at(d, "08:51"),
    acked_by: { by: "family", name: "Priya" },
    steps: [
      { state: "SUSPECT", at: at(d, "08:35") },
      { state: "NUDGE_PARENT", at: at(d, "08:40") },
      { state: "ALERT_FAMILY", at: at(d, "08:45") },
      { state: "RESOLVED", at: at(d, "08:51") },
    ],
  };
}

/** Two nights ago the front door opened at 02:10; Kamala pressed "I'm okay" herself. */
export function resolvedNightDoor(today: string): Alert {
  const d = shiftDateKey(today, -2);
  return {
    alert_id: "alt_mock_night_door",
    home_id: HOME,
    kind: "night_activity",
    zone: "front_door",
    reason: "Front door opened at 02:10 — unusual for this hour",
    state: "RESOLVED",
    created_at: at(d, "02:10"),
    resolved_at: at(d, "02:13"),
    acked_by: { by: "parent", name: "Kamala" },
    steps: [
      { state: "SUSPECT", at: at(d, "02:10") },
      { state: "NUDGE_PARENT", at: at(d, "02:11") },
      { state: "RESOLVED", at: at(d, "02:13") },
    ],
  };
}

const LADDER: AlertState[] = ["SUSPECT", "NUDGE_PARENT", "ALERT_FAMILY"];
const STEPS_FOR: Record<Exclude<StatusColour, "green">, number> = { yellow: 2, red: 3 };

/**
 * Today's open long-inactivity alert: yellow is in NUDGE_PARENT, red in ALERT_FAMILY.
 * Steps are 5 minutes apart, the last one 2 minutes ago, so the screen looks live.
 */
export function openAlert(
  variant: Exclude<StatusColour, "green">,
  lastEvent: TimelineEvent | undefined,
  now: Date,
): Alert {
  const count = STEPS_FOR[variant];
  const created = new Date(now.getTime() - (2 + 5 * (count - 1)) * MIN);
  const steps = LADDER.slice(0, count).map((state, i) => ({
    state,
    at: toIsoZ(new Date(created.getTime() + 5 * i * MIN)),
  }));
  const reason = lastEvent
    ? `No movement anywhere for ${formatDuration(minutesBetween(lastEvent.ts, created))} ` +
      `(last: ${lastEvent.zone.replace("_", " ")} at ${formatTimeIST(lastEvent.ts)})`
    : `No kitchen movement by ${formatTimeIST(created)} (usually 07:40)`;
  return {
    alert_id: "alt_mock_open",
    home_id: HOME,
    kind: lastEvent ? "long_inactivity" : "late_start",
    zone: lastEvent ? null : "kitchen",
    reason,
    state: steps[steps.length - 1]?.state ?? "SUSPECT",
    created_at: toIsoZ(created),
    resolved_at: null,
    acked_by: null,
    steps,
  };
}
