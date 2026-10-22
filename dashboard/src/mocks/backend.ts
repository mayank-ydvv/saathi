/**
 * In-memory stand-in for the Saathi API, used when VITE_USE_MOCK=true. It plays one of three
 * states (green / yellow / red, from `?mock=`) and remembers acks, so pressing "I'm checking"
 * turns the dashboard green just like the real backend.
 */
import type { Result } from "../api/client";
import type {
  AckRequest,
  AckResponse,
  Alert,
  AlertList,
  Digest,
  Home,
  Nudge,
  Routine,
  Status,
  StatusColour,
  Timeline,
  TimelineEvent,
} from "../api/types";
import { now as storyNow } from "../lib/clock";
import { formatTimeIST, todayIST, toIsoZ } from "../lib/time";
import { openAlert, resolvedLateStart, resolvedNightDoor } from "./alerts";
import { eventsFor } from "./day";
import { digest, routine } from "./insights";
import { mockVariant } from "./variant";

const HOME: Home = {
  home_id: "home-demo-1",
  parent_name: "Kamala",
  city: "Chennai",
  zones: ["front_door", "kitchen", "living_room", "bedroom"],
};

/** In yellow / red, nothing has moved for the last 4 h 7 min of today. */
const QUIET_MS = (4 * 60 + 7) * 60_000;

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const notFound = (message: string): Result<never> => ({
  ok: false,
  error: { kind: "not_found", status: 404, message },
});

export interface MockBackend {
  home(): Result<Home>;
  status(): Result<Status>;
  timeline(date: string): Result<Timeline>;
  alerts(limit: number): Result<AlertList>;
  ack(alertId: string, body: AckRequest): Result<AckResponse>;
  digest(date: string): Result<Digest>;
  routine(): Result<Routine>;
  nudge(): Result<Nudge>;
}

export function createMockBackend(
  variant: StatusColour,
  clock: () => Date = storyNow,
): MockBackend {
  let resolved: Alert | null = null; // the open alert, once someone acked it

  const quietSince = (now: Date) =>
    variant === "green" ? now : new Date(now.getTime() - QUIET_MS);

  const today = (now: Date): TimelineEvent[] => eventsFor(todayIST(now), todayIST(now), quietSince(now));

  const currentOpen = (now: Date): Alert | null => {
    if (variant === "green") return null;
    if (resolved) return null;
    return openAlert(variant, today(now).at(-1), now);
  };

  const allAlerts = (now: Date): Alert[] => {
    const open = currentOpen(now);
    const t = todayIST(now);
    return [open ?? resolved, resolvedLateStart(t), resolvedNightDoor(t)].filter(
      (a): a is Alert => a !== null,
    );
  };

  return {
    home: () => ok(HOME),

    status() {
      const now = clock();
      const open = currentOpen(now);
      const last = today(now).at(-1);
      const colour: StatusColour = !open
        ? "green"
        : open.state === "ALERT_FAMILY" || open.state === "ALERT_NEIGHBOUR"
          ? "red"
          : "yellow";
      return ok({
        home_id: HOME.home_id,
        status: colour,
        reason: open?.reason ?? null,
        last_seen: last ? { zone: last.zone, ts: last.ts } : null,
        active_alert_id: open?.alert_id ?? null,
      });
    },

    timeline(date) {
      const now = clock();
      return ok({ date, events: eventsFor(date, todayIST(now), quietSince(now)) });
    },

    alerts: (limit) => ok({ alerts: allAlerts(clock()).slice(0, limit) }),

    ack(alertId, body) {
      const now = clock();
      const alert = allAlerts(now).find((a) => a.alert_id === alertId);
      if (!alert) return notFound(`alert ${alertId} not found`);
      if (alert.state !== "RESOLVED") {
        const at = toIsoZ(now);
        resolved = {
          ...alert,
          state: "RESOLVED",
          resolved_at: at,
          acked_by: { by: body.by, name: body.name },
          steps: [...alert.steps, { state: "RESOLVED", at }],
        };
      }
      return ok({ alert_id: alertId, state: "RESOLVED" });
    },

    digest(date) {
      const now = clock();
      const d = digest(date, todayIST(now), now);
      return d ? ok(d) : notFound("no digest for that date");
    },

    routine: () => ok(routine()),

    nudge() {
      const now = clock();
      const open = currentOpen(now);
      if (!open || open.state === "SUSPECT") {
        return ok({ active: false, alert_id: null, message: null, audio_url: null });
      }
      const hour = Number(formatTimeIST(now).slice(0, 2));
      const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      return ok({
        active: true,
        alert_id: open.alert_id,
        message: `${greeting} Kamala, are you okay? Please press the green button.`,
        audio_url: null,
      });
    },
  };
}

let instance: { variant: StatusColour; backend: MockBackend } | null = null;

/** The page's mock backend; rebuilt when `?mock=` changes. */
export function mockBackend(): MockBackend {
  const variant = mockVariant();
  if (!instance || instance.variant !== variant) {
    instance = { variant, backend: createMockBackend(variant) };
  }
  return instance.backend;
}
