import { useEffect, useState } from "react";
import { now, onClockChange } from "../lib/clock";

/** The dashboard's current time (story clock in mock mode), refreshed every `everyMs`. */
export function useNow(everyMs = 15_000): Date {
  const [value, setValue] = useState(now);
  useEffect(() => {
    const update = () => setValue(now());
    const id = window.setInterval(update, everyMs);
    const unsubscribe = onClockChange(update);
    return () => {
      window.clearInterval(id);
      unsubscribe();
    };
  }, [everyMs]);
  return value;
}
