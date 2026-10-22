import type { RoutineZone } from "../api/types";
import { zoneLabel } from "../lib/labels";
import { peaks } from "../lib/routine";

const HOURS = [0, 6, 12, 18, 24];

/**
 * 24-hour activity from the 96-slot histogram as plain SVG: one bar per 15 minutes, height =
 * share of learned days the slot was active. Labels are HTML so they stay readable at any width.
 */
export function RoutineChart({ zone }: { zone: RoutineZone }) {
  const max = Math.max(1, zone.days_seen, ...zone.hist);
  return (
    <figure>
      <div className="relative">
        {[6, 12, 18].map((h) => (
          <span
            key={h}
            className="absolute inset-y-0 w-px bg-line"
            style={{ left: `${(h / 24) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        <svg
          viewBox="0 0 96 100"
          preserveAspectRatio="none"
          className="relative h-24 w-full"
          role="img"
          aria-label={`${zoneLabel(zone.zone)}: ${peaks(zone.hist)}`}
        >
          {zone.hist.map((count, slot) => {
            if (count <= 0) return null;
            const h = Math.max(4, (count / max) * 100);
            return (
              <rect
                key={slot}
                x={slot + 0.12}
                y={100 - h}
                width={0.76}
                height={h}
                className="fill-accent"
                opacity={0.35 + 0.65 * (count / max)}
              />
            );
          })}
        </svg>
        <div className="h-px bg-line" aria-hidden="true" />
      </div>
      <div className="relative mt-1 h-5 text-xs text-muted" aria-hidden="true">
        {HOURS.map((h) => (
          <span
            key={h}
            className="absolute -translate-x-1/2 tabular-nums first:translate-x-0 last:-translate-x-full"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {String(h).padStart(2, "0")}
            <span className="hidden sm:inline">:00</span>
          </span>
        ))}
      </div>
    </figure>
  );
}
