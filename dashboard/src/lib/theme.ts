/**
 * Light/dark theme: follows the system until the user picks one, then remembers the choice.
 * The choice is a `light` or `dark` class on <html>, which index.css reads.
 */
import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const KEY = "saathi.theme";
const listeners = new Set<() => void>();

function stored(): Theme | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function system(): Theme {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function currentTheme(): Theme {
  return stored() ?? system();
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
}

export function setTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    // not remembered; still applied
  }
  apply(theme);
  listeners.forEach((n) => n());
}

/** Call once before the first render so there is no flash of the wrong theme. */
export function initTheme(): void {
  const s = stored();
  if (s) apply(s);
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (n) => {
      listeners.add(n);
      return () => listeners.delete(n);
    },
    currentTheme,
  );
}
