/**
 * One function per REST endpoint (contract 4.6). Every call returns a typed `Result` instead
 * of throwing, so screens can show friendly loading / empty / error states. With
 * VITE_USE_MOCK=true the same functions answer from `src/mocks/` with a small delay.
 */
import { authHeader, signOutAfterRejection } from "../auth/session";
import { config, MOCK_DELAY_MS } from "../config";
import { mockBackend } from "../mocks/backend";
import type {
  AckRequest,
  AckResponse,
  AlertList,
  Digest,
  Home,
  Nudge,
  Routine,
  Status,
  Timeline,
} from "./types";

export type ApiErrorKind = "network" | "http" | "not_found" | "aborted";

export interface ApiError {
  kind: ApiErrorKind;
  status?: number;
  message: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

interface CallOptions {
  signal?: AbortSignal;
}

function aborted(): Result<never> {
  return { ok: false, error: { kind: "aborted", message: "request cancelled" } };
}

async function detail(resp: Response): Promise<string> {
  try {
    const body = (await resp.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // not JSON
  }
  return `HTTP ${resp.status}`;
}

/**
 * fetch → Result. 404 is its own kind so screens can show an empty state. Every call carries
 * the signed-in family member's id token (C1), renewed first if it is about to expire (M9).
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  let resp: Response;
  try {
    resp = await fetch(`${config.apiBase}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(await authHeader()), ...init.headers },
    });
  } catch (err) {
    if (init.signal?.aborted) return aborted();
    return {
      ok: false,
      error: { kind: "network", message: err instanceof Error ? err.message : "network error" },
    };
  }
  if (!resp.ok) {
    if (resp.status === 401) signOutAfterRejection(); // the API no longer accepts this login
    const kind: ApiErrorKind = resp.status === 404 ? "not_found" : "http";
    return { ok: false, error: { kind, status: resp.status, message: await detail(resp) } };
  }
  try {
    return { ok: true, data: (await resp.json()) as T };
  } catch {
    // e.g. a 200 with an HTML error page from a proxy (M8): an error, not a crash
    return { ok: false, error: { kind: "http", status: resp.status, message: "unexpected response" } };
  }
}

/** Mock answer after MOCK_DELAY_MS, honouring cancellation like a real request would. */
function mock<T>(produce: () => Result<T>, signal?: AbortSignal): Promise<Result<T>> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(aborted());
    const timer = window.setTimeout(() => resolve(produce()), MOCK_DELAY_MS);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve(aborted());
      },
      { once: true },
    );
  });
}

const home = () => `/homes/${encodeURIComponent(config.homeId)}`;

export function getHome({ signal }: CallOptions = {}): Promise<Result<Home>> {
  if (config.useMock) return mock(() => mockBackend().home(), signal);
  return request(home(), { signal });
}

export function getStatus({ signal }: CallOptions = {}): Promise<Result<Status>> {
  if (config.useMock) return mock(() => mockBackend().status(), signal);
  return request(`${home()}/status`, { signal });
}

export function getTimeline(date: string, { signal }: CallOptions = {}): Promise<Result<Timeline>> {
  if (config.useMock) return mock(() => mockBackend().timeline(date), signal);
  return request(`${home()}/timeline?date=${encodeURIComponent(date)}`, { signal });
}

export function getAlerts(limit = 20, { signal }: CallOptions = {}): Promise<Result<AlertList>> {
  if (config.useMock) return mock(() => mockBackend().alerts(limit), signal);
  return request(`${home()}/alerts?limit=${limit}`, { signal });
}

export function ackAlert(
  alertId: string,
  body: AckRequest,
  { signal }: CallOptions = {},
): Promise<Result<AckResponse>> {
  if (config.useMock) return mock(() => mockBackend().ack(alertId, body), signal);
  return request(`/alerts/${encodeURIComponent(alertId)}/ack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

export function getDigest(date: string, { signal }: CallOptions = {}): Promise<Result<Digest>> {
  if (config.useMock) return mock(() => mockBackend().digest(date), signal);
  return request(`${home()}/digest?date=${encodeURIComponent(date)}`, { signal });
}

export function getRoutine({ signal }: CallOptions = {}): Promise<Result<Routine>> {
  if (config.useMock) return mock(() => mockBackend().routine(), signal);
  return request(`${home()}/routine`, { signal });
}

export function getNudge({ signal }: CallOptions = {}): Promise<Result<Nudge>> {
  if (config.useMock) return mock(() => mockBackend().nudge(), signal);
  return request(`${home()}/nudge`, { signal });
}
