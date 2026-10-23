import { Camera } from "lucide-react";
import { useMemo, useState } from "react";
import type { TimelineEvent } from "../api/types";
import { eventTypeLabel, zoneLabel } from "../lib/labels";
import { dayPercent, groupIntoLanes, isVisitorEvent, ZONE_ORDER } from "../lib/timeline";
import { formatTimeIST } from "../lib/time";
import type { RovingHandles } from "../hooks/useRovingTabIndex";
import { useRovingTabIndex } from "../hooks/useRovingTabIndex";
import { zoneColour, zoneTint } from "../lib/zones";

const HOURS = [0, 6, 12, 18, 24];

function describe(e: TimelineEvent): string {
  const extra = e.visitor?.caution ? " · caution" : "";
  return `${zoneLabel(e.zone)} · ${formatTimeIST(e.ts)} · ${eventTypeLabel(e.type)}${extra}`;
}

/** Keep a tooltip inside the lane near the edges of the day. */
const clamp = (pct: number) => Math.min(88, Math.max(12, pct));

/**
 * One coloured lane per zone across 00:00–24:00. Hover, focus or tap a mark and a tooltip opens
 * next to it; doorbell marks with a visitor open the snapshot. `now` draws a labelled line.
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
    <div onMouseLeave={() => setPicked(null)}>
      <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-3 sm:grid-cols-[8.5rem_1fr]">
        <div />
        <div className="relative h-6 text-xs text-muted" aria-hidden="true">
          {HOURS.map((h) => (
            <span
              key={h}
              className="absolute top-1 -translate-x-1/2 tabular-nums first:translate-x-0 last:-translate-x-full"
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {String(h).padStart(2, "0")}
              <span className="hidden sm:inline">:00</span>
            </span>
          ))}
          {nowPct !== null && now ? (
            <span
              className="absolute top-0 z-10 -translate-x-1/2 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-ink tabular-nums"
              style={{ left: `${Math.min(95, Math.max(5, nowPct))}%` }}
            >
              Now {formatTimeIST(now)}
            </span>
          ) : null}
        </div>

        {lanes.map((lane) => (
          <Lane
            key={lane.zone}
            zone={lane.zone}
            events={lane.events}
            nowPct={nowPct}
            picked={picked}
            onPick={setPicked}
            onVisitor={onVisitor}
          />
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {picked ? describe(picked) : ""}
      </p>
      <p className="mt-4 text-sm text-muted">Hover or tap a mark to see what happened. Camera marks open the doorbell snapshot.</p>
    </div>
  );
}

function Lane({
  zone,
  events,
  nowPct,
  picked,
  onPick,
  onVisitor,
}: {
  zone: string;
  events: TimelineEvent[];
  nowPct: number | null;
  picked: TimelineEvent | null;
  onPick: (e: TimelineEvent) => void;
  onVisitor: (e: TimelineEvent) => void;
}) {
  const roving = useRovingTabIndex(events.length);
  const mine = picked && picked.zone === zone ? picked : null;
  return (
    <>
      <p className="flex items-center gap-2 self-center text-[15px] font-semibold">
        <span className="size-3 shrink-0 rounded-full" style={{ background: zoneColour(zone) }} aria-hidden="true" />
        <span className="min-w-0">
          {zoneLabel(zone)}
          <span className="block text-xs font-normal text-muted">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        </span>
      </p>
      <div
        role="group"
        aria-label={`${zoneLabel(zone)}: ${events.length} events`}
        className="relative h-12 rounded-xl"
        style={{ background: zoneTint(zone, 13) }}
      >
        {[6, 12, 18].map((h) => (
          <span
            key={h}
            className="absolute inset-y-2 w-px"
            style={{ left: `${(h / 24) * 100}%`, background: zoneTint(zone, 28) }}
            aria-hidden="true"
          />
        ))}
        {events.map((e, index) => (
          <Mark
            key={e.event_id}
            event={e}
            roving={roving[index]}
            active={mine?.event_id === e.event_id}
            onPick={onPick}
            onVisitor={onVisitor}
          />
        ))}
        {nowPct !== null ? (
          <span
            className="pointer-events-none absolute -inset-y-1.5 w-0.5 rounded-full bg-accent"
            style={{ left: `${nowPct}%` }}
            aria-hidden="true"
          />
        ) : null}
        {mine ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full z-30 mb-2 -translate-x-1/2 rounded-xl bg-accent px-3 py-2 text-sm whitespace-nowrap text-accent-ink shadow-lift"
            style={{ left: `${clamp(dayPercent(mine.ts))}%` }}
          >
            <strong className="font-bold tabular-nums">{formatTimeIST(mine.ts)}</strong> · {eventTypeLabel(mine.type)}
            {mine.visitor?.caution ? " · caution" : ""}
          </span>
        ) : null}
      </div>
    </>
  );
}

function Mark({
  event,
  roving,
  active,
  onPick,
  onVisitor,
}: {
  event: TimelineEvent;
  roving?: RovingHandles;
  active: boolean;
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
        ref={roving?.ref}
        tabIndex={roving?.tabIndex}
        aria-label={label}
        onMouseEnter={() => onPick(event)}
        onFocus={() => {
          roving?.onFocus();
          onPick(event);
        }}
        onKeyDown={(e) => roving?.onKeyDown(e)}
        onClick={() => onVisitor(event)}
        className={`absolute top-1/2 z-10 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-surface text-white shadow-card transition hover:scale-110 ${
          caution ? "bg-bad-solid" : ""
        }`}
        style={{ left, background: caution ? undefined : zoneColour(event.zone) }}
      >
        <Camera className="size-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      ref={roving?.ref}
      tabIndex={roving?.tabIndex}
      aria-label={label}
      onMouseEnter={() => onPick(event)}
      onFocus={() => {
        roving?.onFocus();
        onPick(event);
      }}
      onKeyDown={(e) => roving?.onKeyDown(e)}
      onClick={() => onPick(event)}
      className={`absolute top-1/2 h-7 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition ${
        active ? "scale-y-125 opacity-100" : "opacity-80 hover:opacity-100"
      }`}
      style={{ left, background: zoneColour(event.zone) }}
    />
  );
}
