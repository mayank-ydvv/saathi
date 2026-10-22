/**
 * Response shapes of the Saathi REST API, field for field from the shared contracts:
 * docs/CONTRACTS.md sections 4.4 (alerts) and 4.6 (endpoints). Timestamps are UTC ISO-8601
 * strings ending in "Z"; the dashboard converts them to Asia/Kolkata for display.
 */

export type Zone = "front_door" | "kitchen" | "living_room" | "bedroom";

/** Ring event types the engine uses (contract 4.2); others may appear and are shown as-is. */
export type EventType = "motion.human" | "motion" | "ding" | "package" | "vehicle";

export type StatusColour = "green" | "yellow" | "red";

export type AlertState = "SUSPECT" | "NUDGE_PARENT" | "ALERT_FAMILY" | "ALERT_NEIGHBOUR" | "RESOLVED";

export type AlertKind = "late_start" | "long_inactivity" | "night_activity";

export type AckBy = "parent" | "family" | "neighbour";

/** GET /homes/{home_id} */
export interface Home {
  home_id: string;
  parent_name: string;
  city: string;
  zones: string[];
}

export interface LastSeen {
  zone: string;
  ts: string;
}

/** GET /homes/{home_id}/status */
export interface Status {
  home_id: string;
  status: StatusColour;
  reason: string | null;
  last_seen: LastSeen | null;
  active_alert_id: string | null;
}

/** `describe_visitor` output stored on doorbell events (contract 4.3). */
export interface Visitor {
  summary: string;
  person_count: number;
  uniform_or_badge: boolean;
  carrying_package: boolean;
  caution: boolean;
  caution_reason: string;
}

export interface TimelineEvent {
  event_id: string;
  ts: string;
  zone: string;
  type: string;
  snapshot_url: string | null;
  visitor: Visitor | null;
}

/** GET /homes/{home_id}/timeline?date=YYYY-MM-DD (events sorted by ts) */
export interface Timeline {
  date: string;
  events: TimelineEvent[];
}

export interface AlertStep {
  state: AlertState;
  at: string;
}

export interface AckedBy {
  by: AckBy;
  name: string;
}

/** Alert record (contract 4.4), as returned by GET /homes/{home_id}/alerts */
export interface Alert {
  alert_id: string;
  home_id: string;
  kind: string;
  zone: string | null;
  reason: string;
  state: AlertState;
  created_at: string;
  resolved_at: string | null;
  acked_by: AckedBy | null;
  steps: AlertStep[];
}

export interface AlertList {
  alerts: Alert[];
}

/** POST /alerts/{alert_id}/ack request and response */
export interface AckRequest {
  by: AckBy;
  name: string;
}

export interface AckResponse {
  alert_id: string;
  state: "RESOLVED";
}

/** GET /homes/{home_id}/digest?date=YYYY-MM-DD (404 when there is none yet) */
export interface Digest {
  date: string;
  text: string;
  generated_at: string;
}

export interface RoutineZone {
  zone: string;
  usual_first: string | null;
  hist: number[];
  days_seen: number;
}

/** GET /homes/{home_id}/routine */
export interface Routine {
  zones: RoutineZone[];
}

/** GET /homes/{home_id}/nudge */
export interface Nudge {
  active: boolean;
  alert_id: string | null;
  message: string | null;
  audio_url: string | null;
}
