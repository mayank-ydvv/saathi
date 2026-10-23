import { BadgeCheck, BellRing, DoorClosed, Package, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { getTimeline } from "../api/client";
import type { TimelineEvent } from "../api/types";
import { DayPicker } from "../components/DayPicker";
import { HelpNote } from "../components/HelpNote";
import { Block, Empty, ErrorCard, PageTitle } from "../components/States";
import { Stat } from "../components/TodayStats";
import { BlurFade } from "../components/ui/motion";
import { VisitorPanel } from "../components/VisitorPanel";
import { VisitorThumb } from "../components/VisitorThumb";
import { POLL_TIMELINE_MS } from "../config";
import { useNow } from "../hooks/useNow";
import { usePolling } from "../hooks/usePolling";
import { useTitle } from "../hooks/useTitle";
import { cn } from "../lib/cn";
import { formatDateIST, formatTimeIST, istToUtc, todayIST } from "../lib/time";
import { useLive } from "../state/LiveData";

/** What happens at the front door: doorbell rings and parcels. */
const AT_DOOR = new Set(["ding", "package"]);

export function Visitors() {
  useTitle("Visitors");
  const { home } = useLive();
  const now = useNow();
  const today = todayIST(now);
  const [date, setDate] = useState(today);
  const timeline = usePolling((signal) => getTimeline(date, { signal }), date === today ? POLL_TIMELINE_MS : null, date);
  const [open, setOpen] = useState<TimelineEvent | null>(null);
  const parentName = home.data?.parent_name;
  const events = (timeline.data?.events ?? []).filter((e) => AT_DOOR.has(e.type)).reverse();
  const rings = events.filter((e) => e.type === "ding");
  const flagged = rings.filter((e) => e.visitor?.caution).length;
  const parcels = events.filter((e) => e.type === "package" || e.visitor?.carrying_package).length;
  const label = date === today ? "today" : `on ${formatDateIST(istToUtc(date, "12:00"))}`;

  return (
    <>
      <PageTitle sub="Everyone who came to the door, with the doorbell snapshot. Strangers are flagged.">Visitors</PageTitle>
      <div className="mb-5">
        <DayPicker id="visitors-date" date={date} today={today} onChange={setDate} />
      </div>

      <section aria-label="Visitors summary" className="mb-6 grid grid-cols-3 gap-4">
        <Stat icon={BellRing} label="Doorbell rings">
          <p className="display text-[40px] leading-none font-semibold">{timeline.data ? rings.length : "—"}</p>
        </Stat>
        <Stat icon={ShieldAlert} label="Flagged">
          <p className={cn("display text-[40px] leading-none font-semibold", flagged && "text-bad-ink")}>
            {timeline.data ? flagged : "—"}
          </p>
        </Stat>
        <Stat icon={Package} label="Parcels">
          <p className="display text-[40px] leading-none font-semibold">{timeline.data ? parcels : "—"}</p>
        </Stat>
      </section>

      {timeline.data ? (
        events.length ? (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((e, i) => (
              <li key={e.event_id}>
                <BlurFade delay={i * 0.05} className="h-full">
                  <VisitorCard event={e} onOpen={() => setOpen(e)} />
                </BlurFade>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title={`No visitors ${label}`} icon={DoorClosed}>
            Doorbell rings and parcels show up here with their snapshots.
          </Empty>
        )
      ) : timeline.error ? (
        <ErrorCard what="visitors" error={timeline.error} onRetry={timeline.refresh} />
      ) : (
        <div role="status" aria-label="Loading visitors" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Block key={i} className="h-72" />
          ))}
        </div>
      )}

      <div className="mt-8">
        <HelpNote title="How are visitors checked?">
          <p>
            When the doorbell rings, Saathi saves the camera snapshot and Amazon Bedrock describes it in one sentence: how
            many people, any uniform or badge, any parcel. Someone with no uniform and no parcel is marked{" "}
            <strong>Caution</strong>, so you can call before {parentName ?? "your parent"} opens the door.
          </p>
          <p>A flag is a heads-up, not an alarm: it never starts an alert on its own. Nobody is identified by face.</p>
        </HelpNote>
      </div>

      <VisitorPanel event={open} parentName={parentName} onClose={() => setOpen(null)} />
    </>
  );
}

function VisitorCard({ event, onOpen }: { event: TimelineEvent; onOpen: () => void }) {
  const v = event.visitor;
  const time = formatTimeIST(event.ts);
  const parcel = event.type === "package";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("lift press flex h-full w-full flex-col overflow-hidden rounded-2xl bg-surface text-left shadow-card", v?.caution && "ring-2 ring-bad-dot")}
    >
      <div className="relative">
        <VisitorThumb event={event} alt={`Snapshot at ${time}`} className="aspect-[4/3] w-full" />
        <span className="absolute bottom-3 left-3 rounded-lg bg-black/55 px-2 py-0.5 text-sm font-bold text-white tabular-nums">{time}</span>
        <span
          className={cn(
            "absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
            v?.caution ? "bg-bad-solid text-white" : "bg-surface text-ink",
          )}
        >
          {v?.caution ? <ShieldAlert className="size-3.5" aria-hidden="true" /> : <ShieldCheck className="size-3.5" aria-hidden="true" />}
          {v?.caution ? "Caution" : parcel ? "Parcel" : "Looks fine"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="font-semibold">{v?.summary ?? (parcel ? "A parcel was left at the door." : "Doorbell pressed.")}</p>
        {v?.caution && v.caution_reason ? <p className="mt-1 text-sm text-bad-ink">{v.caution_reason}</p> : null}
        {v ? (
          <p className="mt-auto flex flex-wrap gap-1.5 pt-3 text-xs font-medium text-muted">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1">
              <UserRound className="size-3.5" aria-hidden="true" />
              {v.person_count} {v.person_count === 1 ? "person" : "people"}
            </span>
            {v.uniform_or_badge ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1">
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                Uniform
              </span>
            ) : null}
            {v.carrying_package ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1">
                <Package className="size-3.5" aria-hidden="true" />
                Parcel
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </button>
  );
}
