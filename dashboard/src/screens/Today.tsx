import { useState } from "react";
import { getTimeline } from "../api/client";
import type { TimelineEvent } from "../api/types";
import { AlertBanner } from "../components/AlertBanner";
import { DayTimeline } from "../components/DayTimeline";
import { StatusCard } from "../components/StatusCard";
import { Card, ErrorCard, Loading } from "../components/States";
import { VisitorPanel } from "../components/VisitorPanel";
import { POLL_TIMELINE_MS } from "../config";
import { useNow } from "../hooks/useNow";
import { useTitle } from "../hooks/useTitle";
import { usePolling } from "../hooks/usePolling";
import { isOpen } from "../lib/alerts";
import { todayIST } from "../lib/time";
import { useMockVariant } from "../hooks/useMockVariant";
import { activeAlert, useLive, useOnChange } from "../state/LiveData";

export function Today() {
  useTitle("Today");
  const { home, status, alerts, refreshLive } = useLive();
  const now = useNow();
  const today = todayIST(now);
  const timeline = usePolling((signal) => getTimeline(today, { signal }), POLL_TIMELINE_MS, today);
  const [visitor, setVisitor] = useState<TimelineEvent | null>(null);
  useOnChange(useMockVariant()[0], timeline.refresh);
  const parentName = home.data?.parent_name;
  const open = activeAlert(status.data, alerts.data?.alerts);

  return (
    <div className="flex flex-col gap-5">
      {status.data ? (
        <StatusCard status={status.data} now={now} />
      ) : status.error ? (
        <ErrorCard what="today's status" error={status.error} onRetry={status.refresh} />
      ) : (
        <Loading label="Loading today's status" lines={3} />
      )}

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

      <Card>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Today's activity</h2>
          {timeline.data ? (
            <p className="text-sm text-muted">{timeline.data.events.length} events</p>
          ) : null}
        </div>
        {timeline.data ? (
          <DayTimeline
            events={timeline.data.events}
            zones={home.data?.zones}
            now={now}
            onVisitor={setVisitor}
          />
        ) : timeline.error ? (
          <ErrorCard what="the timeline" error={timeline.error} onRetry={timeline.refresh} />
        ) : (
          <div role="status" aria-label="Loading the timeline" className="h-52 animate-pulse rounded-xl bg-surface-2" />
        )}
      </Card>

      <VisitorPanel event={visitor} parentName={parentName} onClose={() => setVisitor(null)} />
    </div>
  );
}
