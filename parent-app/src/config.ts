/** Build-time settings from VITE_* env vars (see .env.example). */
export const config = {
  apiBase: (import.meta.env.VITE_API_BASE ?? "http://localhost:8000").replace(/\/$/, ""),
  homeId: import.meta.env.VITE_HOME_ID ?? "home-demo-1",
  useMock: (import.meta.env.VITE_USE_MOCK ?? "true") === "true",
};

/** All user-facing times are Asia/Kolkata (contract 4.1). */
export const TIMEZONE = "Asia/Kolkata";
export const POLL_MS = 3_000;
export const REPEAT_VOICE_MS = 30_000;
export const THANKS_MS = 5_000;
export const MOCK_NUDGE_AFTER_MS = 10_000;
