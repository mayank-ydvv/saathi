/** Build-time settings from VITE_* env vars (see .env.example). */
/** In a production build an unset API base means same-origin, never localhost (L11). */
const devApi = import.meta.env.DEV ? "http://localhost:8000" : "";

export const config = {
  apiBase: (import.meta.env.VITE_API_BASE ?? devApi).replace(/\/$/, ""),
  /** Secret sent as X-Device-Token: the API's PARENT_DEVICE_TOKEN (C1). Empty = none. */
  deviceToken: import.meta.env.VITE_DEVICE_TOKEN ?? "",
  homeId: import.meta.env.VITE_HOME_ID ?? "home-demo-1",
  useMock: (import.meta.env.VITE_USE_MOCK ?? "true") === "true",
};

/** All user-facing times are Asia/Kolkata (contract 4.1). */
export const TIMEZONE = "Asia/Kolkata";
export const POLL_MS = 3_000;
export const REPEAT_VOICE_MS = 30_000;
export const THANKS_MS = 5_000;
export const MOCK_NUDGE_AFTER_MS = 10_000;
