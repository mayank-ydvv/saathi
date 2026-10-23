/** Shapes from contract 4.6 that the parent app uses. */
export interface Nudge {
  active: boolean;
  alert_id: string | null;
  message: string | null;
  audio_url: string | null;
}

export interface Home {
  home_id: string;
  parent_name: string;
}

export interface Api {
  getHome(): Promise<Home>;
  getNudge(): Promise<Nudge>;
  ack(alertId: string, name: string): Promise<void>;
}

async function json<T>(resp: Response): Promise<T> {
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return (await resp.json()) as T;
}

/**
 * The real backend: GET /homes/{id}, GET /homes/{id}/nudge, POST /alerts/{id}/ack. Every call
 * carries the tablet's device token when one is configured (C1).
 */
export function createHttpApi(
  base: string,
  homeId: string,
  fetchFn: typeof fetch = fetch,
  deviceToken = "",
): Api {
  const home = encodeURIComponent(homeId);
  const auth: Record<string, string> = deviceToken ? { "X-Device-Token": deviceToken } : {};
  return {
    getHome: async () => json<Home>(await fetchFn(`${base}/homes/${home}`, { headers: auth })),
    getNudge: async () => json<Nudge>(await fetchFn(`${base}/homes/${home}/nudge`, { headers: auth })),
    ack: async (alertId, name) => {
      const resp = await fetchFn(`${base}/alerts/${encodeURIComponent(alertId)}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ by: "parent", name }),
      });
      await json<unknown>(resp);
    },
  };
}

const INACTIVE: Nudge = { active: false, alert_id: null, message: null, audio_url: null };

/**
 * Offline stand-in for the backend: one nudge becomes active `afterMs` after creation and
 * stays active until acknowledged. No audio_url, so the app speaks with the browser's voice.
 */
export function createMockApi(afterMs: number, now: () => number = Date.now): Api {
  const activeFrom = now() + afterMs;
  let acked = false;
  return {
    getHome: async () => ({ home_id: "home-demo-1", parent_name: "Kamala" }),
    getNudge: async () =>
      !acked && now() >= activeFrom
        ? {
            active: true,
            alert_id: "alt_mock",
            message: "Good morning Kamala, are you okay? Please press the green button.",
            audio_url: null,
          }
        : INACTIVE,
    ack: async () => {
      acked = true;
    },
  };
}
