import type { RoutineZone } from "../api/types";
import { zoneLabel } from "../lib/labels";
import { hourShares } from "../lib/routine";
import { zoneColour } from "../lib/zones";

const AXIS = [0, 6, 12, 18];

/**
 * Rooms × hours: each cell is how often that room is busy in that hour across the learned days,
 * from 0% (empty) to 100% (the room's full colour). O(96 × zones).
 */
export function RoutineHeatmap({ zones }: { zones: RoutineZone[] }) {
  return (
    <figure>
      <div role="img" aria-label="How often each room is busy, hour by hour" className="overflow-x-auto">
        <div className="grid min-w-[36rem] grid-cols-[7rem_repeat(24,minmax(0,1fr))] gap-1">
          {zones.map((z) => {
            const shares = hourShares(z);
            return [
              <p key={`${z.zone}-label`} className="flex items-center gap-2 pr-2 text-sm font-semibold">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: zoneColour(z.zone) }} aria-hidden="true" />
                {zoneLabel(z.zone)}
              </p>,
              ...shares.map((pct, hour) => (
                <span
                  key={`${z.zone}-${hour}`}
                  title={`${zoneLabel(z.zone)}, ${String(hour).padStart(2, "0")}:00 · ${pct}% of days`}
                  className="h-8 rounded-md"
                  style={{
                    background:
                      pct > 0 ? `color-mix(in oklab, ${zoneColour(z.zone)} ${Math.max(12, pct)}%, var(--surface-2))` : "var(--surface-2)",
                  }}
                />
              )),
            ];
          })}
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className="text-center text-[11px] text-muted tabular-nums">
              {AXIS.includes(hour) ? String(hour).padStart(2, "0") : ""}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-3 flex items-center gap-2 text-sm text-muted">
        Rarely
        <span className="h-2.5 w-24 rounded-full bg-gradient-to-r from-surface-2 to-ink/60" aria-hidden="true" />
        Almost every day
      </figcaption>
    </figure>
  );
}
