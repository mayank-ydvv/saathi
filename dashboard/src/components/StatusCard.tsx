import type { Status } from "../api/types";
import { statusLook, zoneLabel } from "../lib/labels";
import { timeAgo } from "../lib/time";
import { Icon } from "./Icon";
import { Ripple } from "./ui/effects";

/** Big status card: icon + word + colour (never colour alone), announced politely. */
export function StatusCard({ status, now }: { status: Status; now: Date }) {
  const look = statusLook(status.status);
  const seen = status.last_seen;
  return (
    <section
      aria-labelledby="status-heading"
      className={`overflow-hidden rounded-3xl p-6 shadow-card md:p-8 ${look.tone}`}
      data-status={status.status}
    >
      <div aria-live="polite" aria-atomic="true" className="flex items-start gap-4">
        <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/60 dark:bg-black/20">
          {/* Needs attention: rings breathe out of the icon (Magic UI ripple). */}
          {status.status === "red" ? <Ripple mainCircleSize={60} step={26} numCircles={4} className="overflow-visible text-bad-dot" /> : null}
          <Icon name={look.icon} className="relative h-8 w-8" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-80">Today</p>
          <h1 id="status-heading" className="text-3xl leading-tight font-bold md:text-4xl">
            {look.label}
          </h1>
          {status.reason ? <p className="mt-2 text-lg leading-snug">{status.reason}</p> : null}
        </div>
      </div>
      <p className="mt-5 flex items-baseline gap-2 text-[15px] opacity-90">
        <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${look.dot}`} aria-hidden="true" />
        <span>
          {seen ? (
            <>
              Last seen: <strong className="font-semibold">{zoneLabel(seen.zone)}</strong> ·{" "}
              {timeAgo(seen.ts, now)}
            </>
          ) : (
            "No activity recorded yet today"
          )}
        </span>
      </p>
    </section>
  );
}
