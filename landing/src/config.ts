/**
 * A VITE_* URL, or its local default in `npm run dev`. A production build never links to
 * localhost (L11): unset falls back to a same-origin path.
 */
function url(value: string | undefined, devUrl: string, prodPath: string): string {
  return value ?? (import.meta.env.DEV ? devUrl : prodPath);
}

export const DASHBOARD_URL: string = url(import.meta.env.VITE_DASHBOARD_URL, "http://localhost:5173", "/dashboard/");
/** The parent app (the tablet by Ma's bed), linked from the "I'm okay" section. */
export const PARENT_APP_URL: string = url(import.meta.env.VITE_PARENT_APP_URL, "http://localhost:5174", "/parent/");
export const REPO_URL = "https://github.com/mayank-ydvv/saathi";
