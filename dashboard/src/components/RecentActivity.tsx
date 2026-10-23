import { BellRing, Car, Footprints, Package } from "lucide-react";
import type { TimelineEvent } from "../api/types";
import { zoneLabel } from "../lib/labels";
import { formatTimeIST } from "../lib/time";
import { zoneColour, zoneTint } from "../lib/zones";
import { AnimatedList } from "./ui/motion";

function describe(e: TimelineEvent): string {
  if (e.type === "ding") return e.visitor?.summary ?? "Doorbell pressed";
  if (e.type === "package") return "Parcel at the door";
  if (e.type === "vehicle") return "Vehicle outside";
  return "Movement";
}

function iconFor(type: string) {
  if (type === "ding") return BellRing;
  if (type === "package") return Package;
  if (type === "vehicle") return Car;
  return Footprints;
}

/**
 * The latest events as a Magic UI animated list: they drop in one by one, newest on top, the
 * way the family would have seen them arrive. Shows the last 6 (O(1) slice of the timeline).
 */
export function RecentActivity({ events }: { events: TimelineEvent[] }) {
  const latest = events.slice(-6);
  if (!latest.length) return <p className="text-muted">No activity yet today.</p>;
  return (
    <AnimatedList delay={450} className="items-stretch gap-1">
      {latest.map((e) => {
        const IconCmp = iconFor(e.type);
        return (
          <div key={e.event_id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl"
              style={{ background: zoneTint(e.zone, 18), color: zoneColour(e.zone) }}
            >
              <IconCmp className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ink">{zoneLabel(e.zone)}</p>
              <p className="truncate text-sm text-muted">{describe(e)}</p>
            </div>
            <time dateTime={e.ts} className="text-sm font-semibold tabular-nums">
              {formatTimeIST(e.ts)}
            </time>
          </div>
        );
      })}
    </AnimatedList>
  );
}
