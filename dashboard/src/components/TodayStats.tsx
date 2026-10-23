import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";
import type { TimelineEvent } from "../api/types";
import { useSession } from "../auth/session";
import { config } from "../config";
import { FAMILY } from "../lib/family";
import { zoneLabel } from "../lib/labels";
import { formatTimeIST } from "../lib/time";
import { ChartContainer, type ChartConfig } from "./ui/chart";
import { AvatarCircles } from "./ui/effects";
import { NumberTicker } from "./ui/motion";

/** Engine activity types (backend ENGINE_EVENT_TYPES): package/vehicle aren't the parent. */
const ACTIVITY_TYPES = new Set(["motion.human", "motion", "ding"]);

const roomsConfig = { rooms: { label: "Rooms", color: "var(--accent)" } } satisfies ChartConfig;

function Stat({ label, children, foot }: { label: string; children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="flex min-h-32 flex-col rounded-[6px] border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-1 flex-1">{children}</div>
      {foot ? <p className="mt-2 text-xs text-muted">{foot}</p> : null}
    </div>
  );
}

/**
 * The shadcn dashboard-01 "section cards" row for Today: events so far (Magic UI number
 * ticker), rooms with activity (shadcn radial chart), the latest event and who is watching
 * (Magic UI avatar circles). O(events) to summarise.
 */
export function TodayStats({ events, zones }: { events: TimelineEvent[]; zones: string[] }) {
  // Only signs of the parent being about count (packages and vehicles don't), and only rooms
  // the home has, so the ring can never read "4/1" or go past a full circle (L6).
  const activity = events.filter((e) => ACTIVITY_TYPES.has(e.type));
  const active = new Set(activity.map((e) => e.zone).filter((z) => zones.includes(z)));
  const total = Math.max(zones.length, 1);
  const last = activity.at(-1);
  const session = useSession();
  // The demo family in mock mode; in real mode, who is signed in (no contacts API yet).
  const watching = config.useMock
    ? FAMILY.filter((p) => ["Rahul", "Priya", "Mrs Iyer"].includes(p.name))
    : [];
  const data = [{ name: "rooms", rooms: active.size, fill: "var(--color-rooms)" }];

  return (
    <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Events today" foot="Motion and doorbell, all rooms">
        <NumberTicker value={activity.length} className="flare text-[40px] leading-none" />
      </Stat>
      <Stat label="Rooms active">
        <ChartContainer
          config={roomsConfig}
          className="mx-auto aspect-square h-24"
          role="img"
          aria-label={`${active.size} of ${total} rooms active today`}
        >
          {/* 359.9° at most: a full 360° arc has the same start and end point and draws nothing. */}
          <RadialBarChart data={data} startAngle={90} endAngle={90 - (359.9 * active.size) / total} innerRadius={34} outerRadius={46}>
            <RadialBar dataKey="rooms" background cornerRadius={8} isAnimationActive />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) =>
                  viewBox && "cx" in viewBox && "cy" in viewBox ? (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle" className="fill-ink text-lg">
                      {active.size}/{total}
                    </text>
                  ) : null
                }
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </Stat>
      <Stat label="Latest activity" foot={last ? `at ${formatTimeIST(last.ts)}` : undefined}>
        <p className="flare text-[26px] leading-tight">{last ? zoneLabel(last.zone) : "Nothing yet"}</p>
      </Stat>
      {watching.length ? (
        <Stat label="Family watching" foot={watching.map((p) => p.name).join(", ")}>
          <AvatarCircles people={watching} size={40} className="mt-1" />
        </Stat>
      ) : (
        <Stat label="Signed in" foot={session?.email}>
          <p className="flare text-[26px] leading-tight">{session?.name || "Family"}</p>
        </Stat>
      )}
    </section>
  );
}
