import React, { useState } from "react";
import type { TimelineEvent } from "../api/types";
import { formatLocalTime, getMinuteOfDayInKolkata } from "../utils/time";
import { IconCamera } from "./icons";

interface TimelineLanesProps {
  events: TimelineEvent[];
  onSelectEvent: (event: TimelineEvent) => void;
  selectedEventId?: string | null;
}

const ZONES: Array<{ id: string; label: string; color: string }> = [
  { id: "front_door", label: "Front Door", color: "bg-sky-500 text-sky-950 dark:text-sky-200" },
  { id: "kitchen", label: "Kitchen", color: "bg-amber-500 text-amber-950 dark:text-amber-200" },
  { id: "living_room", label: "Living Room", color: "bg-emerald-500 text-emerald-950 dark:text-emerald-200" },
  { id: "bedroom", label: "Bedroom", color: "bg-indigo-500 text-indigo-950 dark:text-indigo-200" },
];

/**
 * Group events into zone lanes in one O(n) pass and render 24-hour visual lanes.
 * Time complexity: O(n) where n is events.length.
 */
export function TimelineLanes({
  events,
  onSelectEvent,
  selectedEventId,
}: TimelineLanesProps): React.ReactElement {
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);

  // Single O(n) pass grouping
  const groupedEvents: Record<string, TimelineEvent[]> = {
    front_door: [],
    kitchen: [],
    living_room: [],
    bedroom: [],
  };

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev) {
      if (!groupedEvents[ev.zone]) {
        groupedEvents[ev.zone] = [];
      }
      groupedEvents[ev.zone]?.push(ev);
    }
  }

  // Calculate current local "now" line in Asia/Kolkata
  const now = new Date();
  const nowKolkataMinutes = getMinuteOfDayInKolkata(now.toISOString());
  const nowPercent = Math.min(100, Math.max(0, (nowKolkataMinutes / 1440) * 100));

  // Hourly markers for 24-hour grid: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00, 24:00
  const hourTicks = [0, 4, 8, 12, 16, 20, 24];

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            Today's Activity Timeline
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            24-hour motion and doorbell events across parent zones (00:00 – 24:00 IST)
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Motion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>Doorbell Ding</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-rose-600 dark:bg-rose-400" />
            <span>Current Time</span>
          </div>
        </div>
      </div>

      {/* 24h Timeline Chart Container */}
      <div className="relative pt-2 pb-6 overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Time scale headers */}
          <div className="relative h-6 text-[11px] font-mono text-stone-400 border-b border-stone-200 dark:border-stone-800 mb-2">
            {hourTicks.map((hr) => {
              const leftPct = (hr / 24) * 100;
              return (
                <div
                  key={hr}
                  style={{ left: `${leftPct}%` }}
                  className="absolute -translate-x-1/2 bottom-1"
                >
                  {hr.toString().padStart(2, "0")}:00
                </div>
              );
            })}
          </div>

          {/* Lanes */}
          <div className="relative space-y-3">
            {/* "Now" vertical indicator line */}
            <div
              style={{ left: `${nowPercent}%` }}
              className="absolute top-0 bottom-0 z-20 w-0.5 bg-rose-500 shadow-sm pointer-events-none"
              title={`Current time: ${formatLocalTime(now.toISOString())}`}
            >
              <div className="absolute -top-3 -translate-x-1/2 rounded bg-rose-500 px-1 py-0.2 text-[9px] font-bold text-white shadow-xs">
                NOW
              </div>
            </div>

            {ZONES.map((zone) => {
              const zoneEvents = groupedEvents[zone.id] || [];
              return (
                <div key={zone.id} className="group relative flex items-center gap-3">
                  {/* Zone Label */}
                  <div className="w-24 shrink-0 text-xs font-semibold text-stone-700 dark:text-stone-300 truncate">
                    {zone.label}
                  </div>

                  {/* Horizontal Track */}
                  <div className="relative h-10 flex-1 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200/60 dark:border-stone-700/50 overflow-hidden">
                    {/* Hour grid lines */}
                    {hourTicks.map((hr) => (
                      <div
                        key={hr}
                        style={{ left: `${(hr / 24) * 100}%` }}
                        className="absolute top-0 bottom-0 w-px bg-stone-200/50 dark:bg-stone-700/30"
                      />
                    ))}

                    {/* Event marks */}
                    {zoneEvents.map((ev) => {
                      const minutes = getMinuteOfDayInKolkata(ev.ts);
                      const leftPct = (minutes / 1440) * 100;
                      const isDing = ev.type === "ding";
                      const hasVisitor = !!ev.visitor;
                      const hasCaution = ev.visitor?.caution;
                      const isSelected = selectedEventId === ev.event_id;

                      return (
                        <button
                          key={ev.event_id}
                          type="button"
                          onClick={() => onSelectEvent(ev)}
                          onMouseEnter={() => setHoveredEvent(ev)}
                          onMouseLeave={() => setHoveredEvent(null)}
                          style={{ left: `${leftPct}%` }}
                          aria-label={`${zone.label} ${ev.type} at ${formatLocalTime(ev.ts)}`}
                          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 transition-transform hover:scale-125 focus:scale-125 focus:outline-hidden ${
                            isDing
                              ? "h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-stone-900"
                              : hasCaution
                              ? "h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs"
                              : "h-3.5 w-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-400 ring-1 ring-white dark:ring-stone-900"
                          } ${isSelected ? "ring-3 ring-sky-500 scale-125" : ""}`}
                        >
                          {isDing && (
                            <IconCamera className="w-3.5 h-3.5 shrink-0" />
                          )}
                          {!isDing && hasVisitor && (
                            <IconCamera className="w-2.5 h-2.5 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Tooltip / Summary for Hovered or Tapped Event */}
      {hoveredEvent && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-stone-900 px-4 py-2.5 text-xs text-white shadow-md dark:bg-stone-800">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-emerald-400">
              {formatLocalTime(hoveredEvent.ts)}
            </span>
            <span className="text-stone-400">·</span>
            <span className="font-medium capitalize">{hoveredEvent.zone.replace(/_/g, " ")}</span>
            <span className="text-stone-400">·</span>
            <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[11px] font-mono dark:bg-stone-700">
              {hoveredEvent.type}
            </span>
          </div>

          {hoveredEvent.visitor && (
            <div className="flex items-center gap-2">
              <span className="text-stone-300 truncate max-w-xs">
                {hoveredEvent.visitor.summary}
              </span>
              {hoveredEvent.visitor.caution && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  Caution Flag
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
