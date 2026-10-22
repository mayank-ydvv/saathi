/**
 * Saathi Dashboard Typed API Client.
 * Supports direct REST API calls or offline mock fixtures with simulated latency.
 */

import mockAlertsData from "../mocks/alerts.json";
import mockDigestData from "../mocks/digest.json";
import mockHomeData from "../mocks/home.json";
import mockNudgeData from "../mocks/nudge.json";
import mockRoutineData from "../mocks/routine.json";
import mockStatusRedData from "../mocks/status-red.json";
import mockStatusYellowData from "../mocks/status-yellow.json";
import mockStatusData from "../mocks/status.json";
import mockTimelineData from "../mocks/timeline.json";
import type {
  AckRequest,
  AckResponse,
  Alert,
  AlertsResponse,
  ApiResult,
  DigestResponse,
  HealthResponse,
  Home,
  NudgeResponse,
  RoutineResponse,
  Status,
  StatusLevel,
  TimelineResponse,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";
export const DEFAULT_HOME_ID = (import.meta.env.VITE_HOME_ID as string) || "home-demo-1";
export const IS_MOCK_MODE =
  (import.meta.env.VITE_USE_MOCK as string) !== "false";

// In-memory mock states for realistic local interactivity (e.g. alert ack)
let currentMockStatusLevel: StatusLevel | null = null;
const mutableMockAlerts: Alert[] = JSON.parse(JSON.stringify(mockAlertsData.alerts));

export function setMockStatusOverride(level: StatusLevel | null): void {
  currentMockStatusLevel = level;
}

export function getEffectiveMockStatusLevel(): StatusLevel {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const param = params.get("mock")?.toLowerCase();
    if (param === "green" || param === "yellow" || param === "red") {
      return param;
    }
  }
  return currentMockStatusLevel || "green";
}

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResult<T>> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      let message = `Request failed (${res.status} ${res.statusText})`;
      try {
        const errorData = await res.json();
        if (errorData?.detail) {
          message = errorData.detail;
        }
      } catch {
        // Fall back to HTTP status string
      }
      return { success: false, error: message, status: res.status };
    }

    const data: T = await res.json();
    return { success: true, data };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, error: "Request aborted" };
    }
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: message };
  }
}

// ---------------- API FUNCTIONS ---------------- //

export async function getHealth(signal?: AbortSignal): Promise<ApiResult<HealthResponse>> {
  if (IS_MOCK_MODE) {
    await delay();
    return { success: true, data: { ok: true } };
  }
  return fetchJson<HealthResponse>("/health", { signal });
}

export async function getHome(
  homeId: string = DEFAULT_HOME_ID,
  signal?: AbortSignal,
): Promise<ApiResult<Home>> {
  if (IS_MOCK_MODE) {
    await delay();
    return { success: true, data: { ...mockHomeData, home_id: homeId } };
  }
  return fetchJson<Home>(`/homes/${encodeURIComponent(homeId)}`, { signal });
}

export async function getStatus(
  homeId: string = DEFAULT_HOME_ID,
  signal?: AbortSignal,
): Promise<ApiResult<Status>> {
  if (IS_MOCK_MODE) {
    await delay();
    const effective = getEffectiveMockStatusLevel();
    let statusObj: Status;

    if (effective === "red") {
      statusObj = { ...(mockStatusRedData as Status), home_id: homeId };
    } else if (effective === "yellow") {
      statusObj = { ...(mockStatusYellowData as Status), home_id: homeId };
    } else {
      statusObj = { ...(mockStatusData as Status), home_id: homeId };
    }
    return { success: true, data: statusObj };
  }

  return fetchJson<Status>(`/homes/${encodeURIComponent(homeId)}/status`, { signal });
}

export async function getTimeline(
  homeId: string = DEFAULT_HOME_ID,
  date: string = "2026-10-22",
  signal?: AbortSignal,
): Promise<ApiResult<TimelineResponse>> {
  if (IS_MOCK_MODE) {
    await delay();
    return {
      success: true,
      data: {
        date,
        events: mockTimelineData.events.map((e) => ({
          ...e,
          // replace date portion to match requested date if needed
          ts: e.ts.replace(/^\d{4}-\d{2}-\d{2}/, date),
        })),
      },
    };
  }

  const query = new URLSearchParams({ date }).toString();
  return fetchJson<TimelineResponse>(
    `/homes/${encodeURIComponent(homeId)}/timeline?${query}`,
    { signal },
  );
}

export async function getAlerts(
  homeId: string = DEFAULT_HOME_ID,
  limit: number = 20,
  signal?: AbortSignal,
): Promise<ApiResult<AlertsResponse>> {
  if (IS_MOCK_MODE) {
    await delay();
    const activeLevel = getEffectiveMockStatusLevel();
    // Filter or adjust alerts based on mock status level
    const alertsToReturn = mutableMockAlerts
      .filter((a) => {
        if (activeLevel === "green") return a.state === "RESOLVED";
        return true;
      })
      .slice(0, limit);

    return { success: true, data: { alerts: alertsToReturn } };
  }

  return fetchJson<AlertsResponse>(
    `/homes/${encodeURIComponent(homeId)}/alerts?limit=${limit}`,
    { signal },
  );
}

export async function ackAlert(
  alertId: string,
  payload: AckRequest = { by: "family", name: "Anushka" },
  signal?: AbortSignal,
): Promise<ApiResult<AckResponse>> {
  if (IS_MOCK_MODE) {
    await delay(120);
    // Mutate in-memory mock alert
    const target = mutableMockAlerts.find((a) => a.alert_id === alertId);
    if (target) {
      target.state = "RESOLVED";
      target.resolved_at = new Date().toISOString();
      target.acked_by = { by: payload.by, name: payload.name };
      target.steps.push({
        state: "RESOLVED",
        at: new Date().toISOString(),
      });
    }
    // Transition mock status level to green
    currentMockStatusLevel = "green";
    return { success: true, data: { alert_id: alertId, state: "RESOLVED" } };
  }

  return fetchJson<AckResponse>(`/alerts/${encodeURIComponent(alertId)}/ack`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export async function getDigest(
  homeId: string = DEFAULT_HOME_ID,
  date: string = "2026-10-22",
  signal?: AbortSignal,
): Promise<ApiResult<DigestResponse>> {
  if (IS_MOCK_MODE) {
    await delay();
    return {
      success: true,
      data: {
        date,
        text: mockDigestData.text,
        generated_at: mockDigestData.generated_at,
      },
    };
  }

  const query = new URLSearchParams({ date }).toString();
  return fetchJson<DigestResponse>(
    `/homes/${encodeURIComponent(homeId)}/digest?${query}`,
    { signal },
  );
}

export async function getRoutine(
  homeId: string = DEFAULT_HOME_ID,
  signal?: AbortSignal,
): Promise<ApiResult<RoutineResponse>> {
  if (IS_MOCK_MODE) {
    await delay();
    return { success: true, data: mockRoutineData as RoutineResponse };
  }

  return fetchJson<RoutineResponse>(
    `/homes/${encodeURIComponent(homeId)}/routine`,
    { signal },
  );
}

export async function getNudge(
  homeId: string = DEFAULT_HOME_ID,
  signal?: AbortSignal,
): Promise<ApiResult<NudgeResponse>> {
  if (IS_MOCK_MODE) {
    await delay();
    return { success: true, data: mockNudgeData };
  }

  return fetchJson<NudgeResponse>(
    `/homes/${encodeURIComponent(homeId)}/nudge`,
    { signal },
  );
}
