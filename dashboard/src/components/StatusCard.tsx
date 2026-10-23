import { CircleCheck, Clock3, MapPin, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { Status, StatusColour } from "../api/types";
import { cn } from "../lib/cn";
import { FAMILY } from "../lib/family";
import { statusLook, zoneLabel } from "../lib/labels";
import { timeAgo } from "../lib/time";
import { CallLink } from "./CallLink";
import { Ripple } from "./ui/effects";

/** The solid form of each status colour, with text that reads on it. */
const SOLID: Record<StatusColour, { card: string; line: string }> = {
  green: { card: "bg-ok-solid text-white", line: "The day looks like a usual day. Nothing for you to do." },
  yellow: {
    card: "bg-warn-solid text-warn-solid-ink",
    line: "Something looks a little off, so Saathi is checking in at home first.",
  },
  red: { card: "bg-bad-solid text-white", line: "No answer at home yet. Please call, or ask someone nearby to look in." },
};

const ICONS = { check: CircleCheck, clock: Clock3, alert: TriangleAlert };

/**
 * The Today card: the parent's photo, the status in a word with its icon and colour (never
 * colour alone), the reason and where they were last seen. An open alert goes in `children`.
 */
export function StatusCard({
  status,
  now,
  parentName,
  phone,
  children,
}: {
  status: Status;
  now: Date;
  parentName?: string;
  phone?: string | null;
  children?: ReactNode;
}) {
  const look = statusLook(status.status);
  const solid = SOLID[status.status] ?? SOLID.yellow;
  const IconCmp = ICONS[look.icon];
  const seen = status.last_seen;
  const photo = FAMILY[0]?.src;
  return (
    <section
      aria-labelledby="status-heading"
      className={cn("relative overflow-hidden rounded-3xl p-5 shadow-lift md:p-8", solid.card)}
      data-status={status.status}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        {photo ? (
          <div className="relative shrink-0 self-start sm:self-center">
            {status.status === "red" ? (
              <Ripple mainCircleSize={130} step={30} numCircles={3} className="overflow-visible text-white" />
            ) : null}
            <img src={photo} alt="" className="relative size-24 rounded-2xl object-cover ring-4 ring-white/40 md:size-28" />
            <span className="absolute -right-2 -bottom-2 grid size-10 place-items-center rounded-full bg-surface text-ink shadow-card">
              <IconCmp className="size-5" aria-hidden="true" />
            </span>
          </div>
        ) : null}

        <div aria-live="polite" aria-atomic="true" className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-[0.14em] uppercase opacity-80">
            Today{parentName ? ` · ${parentName}` : ""}
          </p>
          <h1 id="status-heading" className="mt-1 text-4xl leading-tight font-semibold md:text-5xl">
            {look.label}
          </h1>
          {status.reason ? <p className="mt-2 text-lg leading-snug font-medium md:text-xl">{status.reason}</p> : null}
          <p className="mt-1 opacity-85">{solid.line}</p>
          <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-xl bg-black/10 px-3 py-1.5 text-[15px]">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {seen ? (
                <>
                  Last seen: <strong className="font-bold">{zoneLabel(seen.zone)}</strong> · {timeAgo(seen.ts, now)}
                </>
              ) : (
                "No activity recorded yet"
              )}
            </span>
          </p>
        </div>

        {phone ? (
          <CallLink
            phone={phone}
            name={parentName}
            className="self-start border-current/30 bg-white/15 px-4 py-2.5 text-[15px] hover:bg-white/25 sm:self-center"
          />
        ) : null}
      </div>
      {children ? <div className="relative mt-6">{children}</div> : null}
    </section>
  );
}
