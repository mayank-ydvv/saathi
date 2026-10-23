import { ArrowRight, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getTimeline } from "../api/client";
import type { TimelineEvent } from "../api/types";
import { AlertBanner } from "../components/AlertBanner";
import { DayTimeline } from "../components/DayTimeline";
import { HelpNote } from "../components/HelpNote";
import { RecentActivity } from "../components/RecentActivity";
import { Block, Card, CardHeader, ErrorCard, Loading } from "../components/States";
import { StatusCard } from "../components/StatusCard";
import { TodayStats } from "../components/TodayStats";
import { BlurFade } from "../components/ui/motion";
import { VisitorPanel } from "../components/VisitorPanel";
import { VisitorThumb } from "../components/VisitorThumb";
import { POLL_TIMELINE_MS } from "../config";
import { useMockVariant } from "../hooks/useMockVariant";
import { useNow } from "../hooks/useNow";
import { usePolling } from "../hooks/usePolling";
import { useTitle } from "../hooks/useTitle";
import { isOpen } from "../lib/alerts";
import { formatTimeIST, todayIST } from "../lib/time";
import { ZONE_ORDER } from "../lib/timeline";
import { activeAlert, useLive, useOnChange } from "../state/LiveData";

export function Today() {
  useTitle("Today");
  const { home, status, alerts, refreshLive } = useLive();
  const { search } = useLocation();
  const now = useNow();
  const today = todayIST(now);
  const timeline = usePolling((signal) => getTimeline(today, { signal }), POLL_TIMELINE_MS, today);
  const [visitor, setVisitor] = useState<TimelineEvent | null>(null);
  useOnChange(useMockVariant()[0], timeline.refresh);
  const parentName = home.data?.parent_name;
  const zones = home.data?.zones ?? ZONE_ORDER;
  const open = activeAlert(status.data, alerts.data?.alerts);
  const rings = timeline.data?.events.filter((e) => e.type === "ding") ?? [];

  return (
    <div className="flex flex-col gap-6">
      {status.data ? (
        <BlurFade>
          <StatusCard status={status.data} now={now} parentName={parentName} phone={home.data?.parent_phone}>
            {open && isOpen(open) ? (
              <AlertBanner
                alert={open}
                parentName={parentName}
                onAcked={() => {
                  refreshLive();
                  timeline.refresh();
                }}
              />
            ) : null}
          </StatusCard>
        </BlurFade>
      ) : status.error ? (
        <ErrorCard what="today's status" error={status.error} onRetry={status.refresh} />
      ) : (
        <div role="status" aria-label="Loading today's status">
          <Block className="h-56 rounded-3xl" />
        </div>
      )}

      {timeline.data ? (
        <BlurFade delay={0.05}>
          <TodayStats events={timeline.data.events} zones={zones} />
        </BlurFade>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Block key={i} className="h-36" />
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Today's activity"
            sub="Every movement and doorbell ring, room by room."
            aside={
              timeline.data ? (
                <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold">{timeline.data.events.length} events</span>
              ) : null
            }
          />
          {timeline.data ? (
            <DayTimeline events={timeline.data.events} zones={zones} now={now} onVisitor={setVisitor} />
          ) : timeline.error ? (
            <ErrorCard what="the timeline" error={timeline.error} onRetry={timeline.refresh} />
          ) : (
            <div role="status" aria-label="Loading the timeline" className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Block key={i} className="h-12" />
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Latest" sub="Newest at the top." />
            {timeline.data ? <RecentActivity events={timeline.data.events} /> : <Loading label="Loading the latest events" lines={4} />}
          </Card>

          <Card>
            <CardHeader title="At the door" sub="Doorbell rings today." />
            {rings.length ? (
              <ul className="flex flex-col gap-2">
                {rings.slice(-3).reverse().map((v) => (
                  <li key={v.event_id}>
                    <button
                      type="button"
                      onClick={() => setVisitor(v)}
                      className="press flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-surface-2"
                    >
                      <VisitorThumb event={v} className="size-12 shrink-0 rounded-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{v.visitor?.summary ?? "Doorbell pressed"}</span>
                        <span className="text-xs text-muted tabular-nums">{formatTimeIST(v.ts)}</span>
                      </span>
                      {v.visitor?.caution ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-bad-bg px-2 py-0.5 text-xs font-bold text-bad-ink">
                          <ShieldAlert className="size-3.5" aria-hidden="true" />
                          Caution
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">{timeline.data ? "No doorbell rings yet today." : " "}</p>
            )}
            <Link
              to={{ pathname: "/visitors", search }}
              className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink underline-offset-4 hover:underline"
            >
              All visitors <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Card>
        </div>
      </div>

      <HelpNote>
        <p>
          <strong>Green</strong> means the day matches {parentName ?? "your parent"}'s usual routine.{" "}
          <strong>Amber</strong> means something is late or too quiet, and Saathi is checking in at home first.{" "}
          <strong>Red</strong> means nobody at home answered, so the family was alerted.
        </p>
        <p>
          <strong>I'm checking</strong> tells everyone you're on it and stops the alert from climbing further. Your
          name is recorded in the alert's history.
        </p>
        <p>
          Each coloured lane on the timeline is a room. Bars are movement; camera marks are doorbell rings with a
          snapshot. Indoor rooms only report movement.
        </p>
      </HelpNote>

      <VisitorPanel event={visitor} parentName={parentName} onClose={() => setVisitor(null)} />
    </div>
  );
}
