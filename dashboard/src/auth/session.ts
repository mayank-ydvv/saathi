/**
 * The signed-in session, shared by every component (useSyncExternalStore) and remembered in
 * localStorage so a refresh keeps you logged in. Expired tokens are renewed with the refresh
 * token; if that fails the user is sent back to the login page.
 */
import { useSyncExternalStore } from "react";
import { setFamilyName } from "../hooks/useFamilyName";
import { createCognitoAuth } from "./cognito";
import { createDemoAuth } from "./demo";
import { AuthError, type AuthProvider, type Session } from "./types";

const KEY = "saathi.session";
const listeners = new Set<() => void>();
let current: Session | null | undefined;

const region = import.meta.env.VITE_COGNITO_REGION ?? "";
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID ?? "";

/** Real Cognito when the stack's client id is configured, otherwise the local demo store. */
export const auth: AuthProvider = clientId && region ? createCognitoAuth(region, clientId) : createDemoAuth();

function read(): Session | null {
  if (current !== undefined) return current;
  try {
    const raw = window.localStorage.getItem(KEY);
    current = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    current = null;
  }
  return current;
}

function emit() {
  listeners.forEach((notify) => notify());
}

export function setSession(s: Session | null): void {
  current = s;
  try {
    if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
    else window.localStorage.removeItem(KEY);
  } catch {
    // not persisted; still signed in for this page
  }
  if (s?.name) setFamilyName(s.name); // acks are sent as the logged-in person
  emit();
}

export function getSession(): Session | null {
  return read();
}

/** Forget the cached value (tests clear localStorage between cases). */
export function resetSessionCache(): void {
  current = undefined;
}

export async function signOut(): Promise<void> {
  const s = read();
  setSession(null);
  if (s) await auth.signOut(s);
}

let refreshing: Promise<Session | null> | null = null;

/**
 * Renews the tokens if they expire within a minute; returns the usable session or null.
 * Only a refresh token Cognito rejects signs you out (M9). Being offline keeps the session,
 * and the next call tries again. Concurrent callers share one refresh.
 */
export async function ensureFresh(now = Date.now()): Promise<Session | null> {
  const s = read();
  if (!s) return null;
  if (s.expiresAt - now > 60_000) return s;
  refreshing ??= auth
    .refresh(s)
    .then((next) => {
      setSession(next);
      return next;
    })
    .catch((err: unknown) => {
      if (err instanceof AuthError && err.code === "NotAuthorizedException") {
        setSession(null);
        return null;
      }
      return s; // offline / throttled: keep it, retry on the next call
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** `Authorization` header for API calls, with a token renewed if needed (C1, M9). */
export async function authHeader(): Promise<Record<string, string>> {
  const s = await ensureFresh();
  return s ? { Authorization: `Bearer ${s.idToken}` } : {};
}

/** The API rejected the token (401): drop the session so the login screen shows. */
export function signOutAfterRejection(): void {
  if (read()) setSession(null);
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, read);
}
