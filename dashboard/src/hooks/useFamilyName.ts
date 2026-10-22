import { useSyncExternalStore } from "react";

const KEY = "saathi.familyName";
export const DEFAULT_FAMILY_NAME = "Family";

const listeners = new Set<() => void>();
let current: string | null = null;

function read(): string {
  if (current !== null) return current;
  try {
    current = window.localStorage.getItem(KEY)?.trim() || DEFAULT_FAMILY_NAME;
  } catch {
    current = DEFAULT_FAMILY_NAME; // storage blocked (private mode): still works, just not saved
  }
  return current;
}

export function setFamilyName(value: string): void {
  current = value.trim().slice(0, 40) || DEFAULT_FAMILY_NAME;
  try {
    window.localStorage.setItem(KEY, current);
  } catch {
    // not persisted; the in-memory value is still used
  }
  listeners.forEach((notify) => notify());
}

/** Forget the cached value (tests clear localStorage between cases). */
export function resetFamilyNameCache(): void {
  current = null;
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** The name sent with "I'm checking" acks, shared by every component and remembered here. */
export function useFamilyName(): [string, (name: string) => void] {
  const name = useSyncExternalStore(subscribe, read);
  return [name, setFamilyName];
}
