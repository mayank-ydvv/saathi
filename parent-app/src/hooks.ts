import { useEffect, useState } from "react";
import type { Api, Nudge } from "./api";
import { TIMEZONE } from "./config";

/** Current time, refreshed every `everyMs`. */
export function useNow(everyMs = 1_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

/** Hour of `date` (0-23) in Asia/Kolkata. */
export function localHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

/**
 * Polls GET /homes/{id}/nudge every `everyMs`, one request at a time (the next poll is
 * scheduled after the previous one settles). Network errors keep the last known value.
 */
export function useNudgePolling(api: Api, everyMs: number): Nudge | null {
  const [nudge, setNudge] = useState<Nudge | null>(null);
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const next = await api.getNudge();
        if (!stopped) setNudge(next);
      } catch {
        // Offline for a moment: keep showing what we had and try again.
      }
      if (!stopped) timer = window.setTimeout(poll, everyMs);
    };
    void poll();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [api, everyMs]);
  return nudge;
}

/** The parent's name from GET /homes/{id}; empty until it loads (or if it can't). */
export function useParentName(api: Api): string {
  const [name, setName] = useState("");
  useEffect(() => {
    let stopped = false;
    api
      .getHome()
      .then((home) => !stopped && setName(home.parent_name))
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [api]);
  return name;
}
