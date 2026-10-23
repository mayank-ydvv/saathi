/**
 * A VITE_* URL, or its local default in `npm run dev`. A production build never falls back
 * to localhost (L11): unset means same-origin (`prodPath`), e.g. behind one CloudFront domain.
 */
function url(value: string | undefined, devUrl: string, prodPath: string): string {
  return value ?? (import.meta.env.DEV ? devUrl : prodPath);
}

/** Build-time settings from the VITE_* variables (see .env.example). */
export const config = {
  apiBase: url(import.meta.env.VITE_API_BASE, "http://localhost:8000", "").replace(/\/$/, ""),
  homeId: import.meta.env.VITE_HOME_ID ?? "home-demo-1",
  useMock: (import.meta.env.VITE_USE_MOCK ?? "true") === "true",
  /** The public landing page; the saathi wordmark links back to it. */
  landingUrl: url(import.meta.env.VITE_LANDING_URL, "http://localhost:5175", "/"),
};

/** Polling intervals (ms). */
export const POLL_STATUS_MS = 5_000;
export const POLL_TIMELINE_MS = 30_000;

/** Artificial latency for mock responses, so loading states are visible. */
export const MOCK_DELAY_MS = 250;
