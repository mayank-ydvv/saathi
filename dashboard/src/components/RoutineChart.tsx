import React from "react";
import type { RoutineZone } from "../api/types";
import { IconClock, IconInfo } from "./icons";

interface RoutineChartProps {
  routine: RoutineZone;
}

function formatZoneName(zone: string): string {
  switch (zone.toLowerCase()) {
    case "kitchen":
      return "Kitchen";
    case "living_room":
      return "Living Room";
    case "front_door":
      return "Front Door";
    case "bedroom":
      return "Bedroom";
    default:
      return zone.replace(/_/g, " ");
  }
}

export function RoutineChart({ routine }: RoutineChartProps): React.ReactElement {
  const { zone, usual_first, hist, days_seen } = routine;
  const isLearning = days_seen < 14;

  const maxCount = Math.max(...hist, 1);
  const chartWidth = 600;
  const chartHeight = 90;
  const barWidth = chartWidth / 96;

  // Calculate usual first marker X position
  let usualFirstMarkerX: number | null = null;
  if (usual_first) {
    const [hStr, mStr] = usual_first.split(":");
    const hours = parseInt(hStr || "0", 10);
    const minutes = parseInt(mStr || "0", 10);
    const totalMinutes = hours * 60 + minutes;
    usualFirstMarkerX = (totalMinutes / 1440) * chartWidth;
  }

  const timeTicks = [
    { label: "00:00", pct: 0 },
    { label: "06:00", pct: 25 },
    { label: "12:00", pct: 50 },
    { label: "18:00", pct: 75 },
    { label: "24:00", pct: 100 },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900 transition-all">
      {/* Zone Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
            {formatZoneName(zone)}
          </h3>
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            <IconClock className="w-3.5 h-3.5 text-stone-400" />
            <span>
              {usual_first
                ? `Usually first active at ${usual_first} IST`
                : "No baseline morning time established"}
            </span>
          </div>
        </div>

        {/* Days Seen Badge */}
        <div className="shrink-0">
          {isLearning ? (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
              <IconInfo className="w-3.5 h-3.5" />
              <span>Learning routine ({days_seen} of 14 days)</span>
            </div>
          ) : (
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
              <span>Established Baseline ({days_seen} days)</span>
            </div>
          )}
        </div>
      </div>

      {/* SVG 24-Hour Activity Histogram */}
      <div className="relative pt-2 pb-5 overflow-x-auto">
        <div className="min-w-[500px]">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight + 15}`}
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label={`24-hour activity distribution for ${formatZoneName(zone)}`}
          >
            {/* Background baseline */}
            <line
              x1="0"
              y1={chartHeight}
              x2={chartWidth}
              y2={chartHeight}
              stroke="currentColor"
              className="text-stone-200 dark:text-stone-800"
              strokeWidth="1"
            />

            {/* Histogram bars */}
            {hist.map((count: number, idx: number) => {

              const barHeight = count > 0 ? Math.max(3, (count / maxCount) * (chartHeight - 10)) : 0;
              const x = idx * barWidth;
              const y = chartHeight - barHeight;

              return (
                <rect
                  key={idx}
                  x={x + 0.5}
                  y={y}
                  width={Math.max(1, barWidth - 1)}
                  height={barHeight}
                  rx="1"
                  className={
                    count > 0
                      ? "fill-emerald-600/80 hover:fill-emerald-500 dark:fill-emerald-400/80 transition-colors"
                      : "fill-transparent"
                  }
                >
                  <title>{`Slot ${idx + 1} (${count} active days over window)`}</title>
                </rect>
              );
            })}

            {/* Usual first active vertical line marker */}
            {usualFirstMarkerX !== null && (
              <g>
                <line
                  x1={usualFirstMarkerX}
                  y1="0"
                  x2={usualFirstMarkerX}
                  y2={chartHeight}
                  stroke="#0284c7"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
                <circle cx={usualFirstMarkerX} cy={4} r="3" fill="#0284c7" />
              </g>
            )}

            {/* Time labels underneath */}
            {timeTicks.map((tick) => {
              const x = (tick.pct / 100) * chartWidth;
              return (
                <text
                  key={tick.label}
                  x={x}
                  y={chartHeight + 14}
                  textAnchor={tick.pct === 0 ? "start" : tick.pct === 100 ? "end" : "middle"}
                  className="fill-stone-400 dark:fill-stone-500 font-mono text-[10px]"
                >
                  {tick.label}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
