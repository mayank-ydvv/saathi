/** Build-time settings from the VITE_* variables (see .env.example). */
export const config = {
  apiBase: (import.meta.env.VITE_API_BASE ?? "http://localhost:8000").replace(/\/$/, ""),
  homeId: import.meta.env.VITE_HOME_ID ?? "home-demo-1",
  useMock: (import.meta.env.VITE_USE_MOCK ?? "true") === "true",
};

/** Polling intervals (ms). */
export const POLL_STATUS_MS = 5_000;
export const POLL_TIMELINE_MS = 30_000;

/** Artificial latency for mock responses, so loading states are visible. */
export const MOCK_DELAY_MS = 250;
