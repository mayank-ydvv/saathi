import { useMemo, useState } from "react";
import type { TimelineEvent } from "../api/types";
import { eventTypeLabel, zoneLabel } from "../lib/labels";
import { dayPercent, groupIntoLanes, isVisitorEvent, ZONE_ORDER } from "../lib/timeline";
import { formatTimeIST } from "../lib/time";
import { Icon } from "./Icon";

const HOURS = [0, 6, 12, 18, 24];

function describe(e: TimelineEvent): string {
  const extra = e.visitor?.caution ? " · caution" : "";
  return `${zoneLabel(e.zone)} · ${formatTimeIST(e.ts)} · ${eventTypeLabel(e.type)}${extra}`;
}

/**
 * One lane per zone across 00:00–24:00. Hover, focus or tap a mark to read it; doorbell marks
 * with a visitor open the snapshot. `now` draws the current-time line (today only).
 */
export function DayTimeline({
  events,
  zones = ZONE_ORDER,
  now,
  onVisitor,
}: {
  events: TimelineEvent[];
  zones?: readonly string[];
  now: Date | null;
  onVisitor: (e: TimelineEvent) => void;
}) {
  const lanes = useMemo(() => groupIntoLanes(events, zones), [events, zones]);
  const [picked, setPicked] = useState<TimelineEvent | null>(null);
  const nowPct = now ? dayPercent(now) : null;

  return (
    <div>
      <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 sm:grid-cols-[8rem_1fr]">
        <div />
        <div className="relative h-5 text-xs text-muted" aria-hidden="true">
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

        {lanes.map((lane) => (
          <Lane
            key={lane.zone}
            zone={lane.zone}
            events={lane.events}
            nowPct={nowPct}
            onPick={setPicked}
            onVisitor={onVisitor}
          />
        ))}
      </div>

      <p className="mt-4 min-h-6 text-[15px] text-muted" aria-live="polite">
        {picked ? describe(picked) : "Tap or hover a mark to see what happened."}
      </p>
    </div>
  );
}

function Lane({
  zone,
  events,
  nowPct,
  onPick,
  onVisitor,
}: {
  zone: string;
  events: TimelineEvent[];
  nowPct: number | null;
  onPick: (e: TimelineEvent) => void;
  onVisitor: (e: TimelineEvent) => void;
}) {
  return (
    <>
      <p className="self-center text-[15px] font-medium">
        {zoneLabel(zone)}
        <span className="block text-xs font-normal text-muted">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </p>
      <div
        role="group"
        aria-label={`${zoneLabel(zone)}: ${events.length} events`}
        className="relative h-11 rounded-xl bg-surface-2"
      >
        {[6, 12, 18].map((h) => (
          <span
            key={h}
            className="absolute inset-y-2 w-px bg-line"
            style={{ left: `${(h / 24) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        {events.map((e) => (
          <Mark key={e.event_id} event={e} onPick={onPick} onVisitor={onVisitor} />
        ))}
        {nowPct !== null ? (
          <span
            className="pointer-events-none absolute -inset-y-1 w-0.5 rounded-full bg-accent"
            style={{ left: `${nowPct}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
    </>
  );
}

function Mark({
  event,
  onPick,
  onVisitor,
}: {
  event: TimelineEvent;
  onPick: (e: TimelineEvent) => void;
  onVisitor: (e: TimelineEvent) => void;
}) {
  const visitor = isVisitorEvent(event);
  const left = `${dayPercent(event.ts)}%`;
  const label = describe(event) + (visitor ? ". Open the snapshot" : "");

  if (visitor) {
    const caution = event.visitor?.caution;
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        onMouseEnter={() => onPick(event)}
        onFocus={() => onPick(event)}
        onClick={() => onVisitor(event)}
        className={`absolute top-1/2 z-10 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-surface shadow ${caution ? "bg-bad-dot text-white" : "bg-accent text-accent-ink"}`}
        style={{ left }}
      >
        <Icon name="camera" className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseEnter={() => onPick(event)}
      onFocus={() => onPick(event)}
      onClick={() => onPick(event)}
      className="absolute top-1/2 h-6 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/80 hover:scale-y-125 hover:bg-accent focus-visible:bg-accent"
      style={{ left }}
    />
  );
}
