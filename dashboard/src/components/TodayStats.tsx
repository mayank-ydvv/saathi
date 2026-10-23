import { Activity, BellRing, DoorOpen, Sunrise, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";
import type { TimelineEvent } from "../api/types";
import { zoneLabel } from "../lib/labels";
import { formatTimeIST } from "../lib/time";
import { ChartContainer, type ChartConfig } from "./ui/chart";
import { NumberTicker } from "./ui/motion";

const roomsConfig = { rooms: { label: "Rooms", color: "var(--ok-dot)" } } satisfies ChartConfig;

/** A small stat card: icon and label on top, one big value, an optional line underneath. */
export function Stat({ icon: IconCmp, label, children, foot }: { icon: LucideIcon; label: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="lift flex min-h-36 flex-col rounded-2xl bg-surface p-5 shadow-card">
      <p className="flex items-center gap-2 text-sm font-medium text-muted">
        <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-ink">
          <IconCmp className="size-4" aria-hidden="true" />
        </span>
        {label}
      </p>
      <div className="mt-3 flex-1">{children}</div>
      {foot ? <p className="mt-2 text-sm text-muted">{foot}</p> : null}
    </div>
  );
}

/**
 * Four stat cards for Today: events so far (Magic UI number ticker), rooms with activity (shadcn
 * radial chart), when the day started, and doorbell rings. O(events) to summarise.
 */
/** Engine activity types (backend ENGINE_EVENT_TYPES): package/vehicle aren't the parent. */
const ACTIVITY_TYPES = new Set(["motion.human", "motion", "ding"]);

export function TodayStats({ events, zones }: { events: TimelineEvent[]; zones: readonly string[] }) {
  // Only signs of the parent being about count (packages and vehicles don't), and only rooms
  // the home has, so the ring can never read "4/1" or go past a full circle (L6).
  const activity = events.filter((e) => ACTIVITY_TYPES.has(e.type));
  const active = new Set(activity.map((e) => e.zone).filter((z) => zones.includes(z)));
  const total = Math.max(zones.length, 1);
  const first = activity[0];
  const rings = events.filter((e) => e.type === "ding");
  const flagged = rings.filter((e) => e.visitor?.caution).length;
  const data = [{ name: "rooms", rooms: active.size, fill: "var(--color-rooms)" }];

  return (
    <section aria-label="Today at a glance" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat icon={Activity} label="Events today" foot="Motion and doorbell, all rooms">
        <NumberTicker value={activity.length} className="display text-[44px] leading-none font-semibold" />
      </Stat>
      <Stat icon={DoorOpen} label="Rooms active">
        <ChartContainer
          config={roomsConfig}
          className="aspect-square h-20"
          role="img"
          aria-label={`${active.size} of ${total} rooms active today`}
        >
          {/* 359.9° at most: a full 360° arc has the same start and end point and draws nothing. */}
          <RadialBarChart data={data} startAngle={90} endAngle={90 - (359.9 * active.size) / total} innerRadius={30} outerRadius={40}>
            <RadialBar dataKey="rooms" background cornerRadius={8} isAnimationActive />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) =>
                  viewBox && "cx" in viewBox && "cy" in viewBox ? (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle" className="fill-ink text-base font-bold">
                      {active.size}/{total}
                    </text>
                  ) : null
                }
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </Stat>
      <Stat icon={Sunrise} label="Day started" foot={first ? `First movement: ${zoneLabel(first.zone)}` : "Waiting for the first movement"}>
        <p className="display text-[40px] leading-none font-semibold tabular-nums">{first ? formatTimeIST(first.ts) : "—"}</p>
      </Stat>
      <Stat icon={BellRing} label="Doorbell rings" foot={flagged ? `${flagged} flagged for caution` : "No strangers flagged"}>
        <NumberTicker value={rings.length} className="display text-[44px] leading-none font-semibold" />
      </Stat>
    </section>
  );
}
