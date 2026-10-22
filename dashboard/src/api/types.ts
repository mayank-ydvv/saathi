/**
 * Saathi REST API TypeScript contracts.
 * Matches Sections 4.4 and 4.6 of the Saathi system specifications exactly.
 */

export type StatusLevel = "green" | "yellow" | "red";

export type EscalationState =
  | "SUSPECT"
  | "NUDGE_PARENT"
  | "ALERT_FAMILY"
  | "ALERT_NEIGHBOUR"
  | "RESOLVED";

export type AnomalyKind = "late_start" | "long_inactivity" | "night_activity" | string;

export type ZoneName = "front_door" | "kitchen" | "living_room" | "bedroom" | string;

export type RingEventType =
  | "motion.human"
  | "motion"
  | "ding"
  | "package"
  | "vehicle"
  | string;

export interface Home {
  home_id: string;
  parent_name: string;
  city: string;
  zones: string[];
}

export interface LastSeen {
  zone: string;
  ts: string; // ISO 8601 UTC
}

export interface Status {
  home_id: string;
  status: StatusLevel;
  reason: string | null;
  last_seen: LastSeen | null;
  active_alert_id: string | null;
}

export interface VisitorDescription {
  summary: string;
  person_count: number;
  uniform_or_badge: boolean;
  carrying_package: boolean;
  caution: boolean;
  caution_reason: string;
}

export interface TimelineEvent {
  event_id: string;
  ts: string; // ISO 8601 UTC
  zone: string;
  type: RingEventType;
  snapshot_url: string | null;
  visitor: VisitorDescription | null;
}

export interface TimelineResponse {
  date: string; // YYYY-MM-DD
  events: TimelineEvent[];
}

export interface AlertStep {
  state: EscalationState | string;
  at: string; // ISO 8601 UTC
}

export interface AckedBy {
  by: "parent" | "family" | "neighbour";
  name: string;
}

export interface Alert {
  alert_id: string;
  home_id: string;
  kind: AnomalyKind;
  zone: string | null;
  reason: string;
  state: EscalationState;
  created_at: string; // ISO 8601 UTC
  resolved_at: string | null;
  acked_by: AckedBy | null;
  steps: AlertStep[];
}

export interface AlertsResponse {
  alerts: Alert[];
}

export interface AckRequest {
  by: "parent" | "family" | "neighbour";
  name: string;
}

export interface AckResponse {
  alert_id: string;
  state: "RESOLVED";
}

export interface DigestResponse {
  date: string; // YYYY-MM-DD
  text: string;
  generated_at: string; // ISO 8601 UTC
}

export interface RoutineZone {
  zone: string;
  usual_first: string | null; // e.g. "08:05"
  hist: number[]; // 96 slot counts
  days_seen: number;
}

export interface RoutineResponse {
  zones: RoutineZone[];
}

export interface NudgeResponse {
  active: boolean;
  alert_id: string | null;
  message: string | null;
  audio_url: string | null;
}

export interface HealthResponse {
  ok: boolean;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number };
