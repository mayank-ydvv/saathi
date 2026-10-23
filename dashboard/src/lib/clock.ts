/**
 * The dashboard's "now".
 * - Mock mode: a story clock that starts at today 16:30 IST (or `?time=HH:MM`) when the page
 *   loads and then ticks in real time, so the mock day looks the same whenever it's filmed.
 * - Real mode: device time, unless the backend runs a demo clock. `GET /_dev/clock` exists only
 *   when the backend has DEMO_MODE=true (scenarios set it to e.g. 10:20); the dashboard then
 *   follows it so the timeline and "last seen" agree with the alerts. Otherwise: device time.
 */
import { config } from "../config";
import { istToUtc, todayIST } from "./time";

export const MOCK_STORY_TIME = "16:30";
const SYNC_EVERY_MS = 10_000;

const loadedAt = Date.now();
let storyStart: number | null = null;
let serverOffsetMs = 0;
const listeners = new Set<() => void>();

/** Run `notify` whenever the clock jumps (a demo-clock sync moved it). Returns unsubscribe. */
export function onClockChange(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

function setOffset(ms: number) {
  const jumped = Math.abs(ms - serverOffsetMs) > 1_000;
  serverOffsetMs = ms;
  if (jumped) listeners.forEach((notify) => notify());
}

/** `HH:MM` from `?time=`, or the default story time. */
export function storyTime(search: string = window.location.search): string {
  const value = new URLSearchParams(search).get("time");
  return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : MOCK_STORY_TIME;
}

export function now(): Date {
  if (!config.useMock) return new Date(Date.now() + serverOffsetMs);
  storyStart ??= istToUtc(todayIST(), storyTime()).getTime();
  return new Date(storyStart + (Date.now() - loadedAt));
}

export type SyncResult = "synced" | "absent" | "error";

/**
 * One sync. "absent" when the backend has no demo clock (404, e.g. production), "error" when
 * it couldn't be reached. Uses the midpoint of the round trip.
 */
export async function syncServerClock(signal?: AbortSignal): Promise<SyncResult> {
  const sent = Date.now();
  try {
    const resp = await fetch(`${config.apiBase}/_dev/clock`, { signal });
    if (resp.status === 404) return "absent";
    if (!resp.ok) return "error";
    const body = (await resp.json()) as { now?: unknown };
    const server = typeof body.now === "string" ? Date.parse(body.now) : NaN;
    if (Number.isNaN(server)) return "error";
    setOffset(server - (sent + Date.now()) / 2);
    return "synced";
  } catch {
    return "error";
  }
}

const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 60_000;

/**
 * Real mode only: follow the backend's demo clock while it exists. A failed sync (backend
 * still starting) is retried with back-off; only a 404 stops it (M7). Returns a stop function.
 */
export function startServerClockSync(): () => void {
  if (config.useMock) return () => undefined;
  const ctrl = new AbortController();
  let timer: number | undefined;
  let retry = RETRY_MIN_MS;
  const tick = async () => {
    const result = await syncServerClock(ctrl.signal);
    if (ctrl.signal.aborted || result === "absent") return;
    if (result === "synced") {
      retry = RETRY_MIN_MS;
      timer = window.setTimeout(tick, SYNC_EVERY_MS);
    } else {
      timer = window.setTimeout(tick, retry);
      retry = Math.min(retry * 2, RETRY_MAX_MS);
    }
  };
  void tick();
  return () => {
    ctrl.abort();
    window.clearTimeout(timer);
  };
}

/** For tests. */
export function resetServerClock(): void {
  serverOffsetMs = 0;
}
