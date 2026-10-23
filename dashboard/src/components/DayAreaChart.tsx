import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import type { RoutineZone } from "../api/types";
import { zoneLabel } from "../lib/labels";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "./ui/chart";

/** One earthy colour per room, from the status palette (no new accent colours). */
const COLOURS = ["var(--accent)", "var(--ok-dot)", "var(--warn-dot)", "var(--bad-dot)"];

/**
 * shadcn "interactive area chart" (ui.shadcn.com/charts/area): how likely each room is to be
 * busy at each hour, from the learned 96-slot routine (4 slots → 1 hour, as % of days seen).
 * Buttons pick all rooms or one, like the original's range select. O(96 × zones).
 */
export function DayAreaChart({ zones }: { zones: RoutineZone[] }) {
  const [only, setOnly] = useState<string | null>(null);
  const shown = only ? zones.filter((z) => z.zone === only) : zones;

  const config: ChartConfig = Object.fromEntries(
    zones.map((z, i) => [z.zone, { label: zoneLabel(z.zone), color: COLOURS[i % COLOURS.length] }]),
  );
  const data = Array.from({ length: 24 }, (_, hour) => {
    const row: Record<string, number> = { hour };
    for (const z of zones) {
      const slots = z.hist.slice(hour * 4, hour * 4 + 4);
      const days = Math.max(1, z.days_seen);
      row[z.zone] = Math.min(100, Math.round((Math.max(0, ...slots) / days) * 100));
    }
    return row;
  });

  const btn = (active: boolean) =>
    `rounded-[4px] px-2.5 py-1 text-sm ${active ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Rooms on the chart">
        <button type="button" className={btn(only === null)} aria-pressed={only === null} onClick={() => setOnly(null)}>
          All rooms
        </button>
        {zones.map((z) => (
          <button key={z.zone} type="button" className={btn(only === z.zone)} aria-pressed={only === z.zone} onClick={() => setOnly(z.zone)}>
            {zoneLabel(z.zone)}
          </button>
        ))}
      </div>
      <ChartContainer config={config} className="aspect-auto h-[240px] w-full" role="img" aria-label="Chance each room is busy, hour by hour">
        <AreaChart data={data} margin={{ left: 4, right: 4 }}>
          <defs>
            {zones.map((z) => (
              <linearGradient key={z.zone} id={`fill-${z.zone}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${z.zone})`} stopOpacity={0.5} />
                <stop offset="95%" stopColor={`var(--color-${z.zone})`} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} />
          <YAxis hide domain={[0, 100]} />
          <XAxis
            dataKey="hour"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(h: number) => `${String(h).padStart(2, "0")}:00`}
          />
          <Tooltip
            cursor={false}
            content={
              <ChartTooltipContent
                config={config}
                labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`}
                valueFormatter={(v) => `${String(v)}% of days`}
              />
            }
          />
          {shown.map((z) => (
            <Area
              key={z.zone}
              dataKey={z.zone}
              type="monotone"
              fill={`url(#fill-${z.zone})`}
              stroke={`var(--color-${z.zone})`}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
