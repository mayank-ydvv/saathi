/**
 * The dashboard's "now". Real mode: the real time. Mock mode: a story clock that starts at
 * today 16:30 IST (or `?time=HH:MM`) when the page loads and then ticks in real time, so the
 * mock day looks the same whenever the demo is filmed.
 */
import { config } from "../config";
import { istToUtc, todayIST } from "./time";

export const MOCK_STORY_TIME = "16:30";

const loadedAt = Date.now();
let storyStart: number | null = null;

/** `HH:MM` from `?time=`, or the default story time. */
export function storyTime(search: string = window.location.search): string {
  const value = new URLSearchParams(search).get("time");
  return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : MOCK_STORY_TIME;
}

export function now(): Date {
  if (!config.useMock) return new Date();
  storyStart ??= istToUtc(todayIST(), storyTime()).getTime();
  return new Date(storyStart + (Date.now() - loadedAt));
}
