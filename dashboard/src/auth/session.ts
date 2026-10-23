/**
 * The signed-in session, shared by every component (useSyncExternalStore) and remembered in
 * localStorage so a refresh keeps you logged in. Expired tokens are renewed with the refresh
 * token; if that fails the user is sent back to the login page.
 */
import { useSyncExternalStore } from "react";
import { setFamilyName } from "../hooks/useFamilyName";
import { createCognitoAuth } from "./cognito";
import { createDemoAuth } from "./demo";
import type { AuthProvider, Session } from "./types";

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

/** Renews the tokens if they expire within a minute. Returns the usable session or null. */
export async function ensureFresh(now = Date.now()): Promise<Session | null> {
  const s = read();
  if (!s) return null;
  if (s.expiresAt - now > 60_000) return s;
  try {
    const next = await auth.refresh(s);
    setSession(next);
    return next;
  } catch {
    setSession(null);
    return null;
  }
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, read);
}
