import { useEffect, useState } from "react";
import { now } from "../lib/clock";

/** The dashboard's current time (story clock in mock mode), refreshed every `everyMs`. */
export function useNow(everyMs = 15_000): Date {
  const [value, setValue] = useState(now);
  useEffect(() => {
    const id = window.setInterval(() => setValue(now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return value;
}
