import type { TimelineEvent } from "../api/types";
import { zoneLabel } from "../lib/labels";
import { formatTimeIST } from "../lib/time";
import { Icon } from "./Icon";
import { AnimatedList } from "./ui/motion";

function describe(e: TimelineEvent): string {
  if (e.type === "ding") return e.visitor?.summary ?? "Doorbell pressed";
  if (e.type === "package") return "Parcel at the door";
  if (e.type === "vehicle") return "Vehicle outside";
  return "Movement";
}

/**
 * The latest events as a Magic UI animated list: they drop in one by one, newest on top, the
 * way the family would have seen them arrive. Shows the last 6 (O(1) slice of the timeline).
 */
export function RecentActivity({ events }: { events: TimelineEvent[] }) {
  const latest = events.slice(-6);
  if (!latest.length) return <p className="text-muted">No activity yet today.</p>;
  return (
    <AnimatedList delay={450} className="items-stretch gap-2">
      {latest.map((e) => (
        <div key={e.event_id} className="flex items-center gap-3 rounded-[6px] border border-line bg-canvas px-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink">
            <Icon name={e.type === "ding" || e.type === "package" ? "bell" : "today"} className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] text-ink">{zoneLabel(e.zone)}</p>
            <p className="truncate text-sm text-muted">{describe(e)}</p>
          </div>
          <time dateTime={e.ts} className="text-sm tabular-nums text-muted">
            {formatTimeIST(e.ts)}
          </time>
        </div>
      ))}
    </AnimatedList>
  );
}
