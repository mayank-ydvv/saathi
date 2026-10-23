import { useState } from "react";
import { getTimeline } from "../api/client";
import type { TimelineEvent } from "../api/types";
import { AlertBanner } from "../components/AlertBanner";
import { DayTimeline } from "../components/DayTimeline";
import { StatusCard } from "../components/StatusCard";
import { Card, ErrorCard, Loading } from "../components/States";
import { VisitorPanel } from "../components/VisitorPanel";
import { POLL_TIMELINE_MS } from "../config";
import { NOTIFICATION_DISMISS_KEY, useNotifications } from "../hooks/useNotifications";
import { useNow } from "../hooks/useNow";
import { useTitle } from "../hooks/useTitle";
import { usePolling } from "../hooks/usePolling";
import { isOpen } from "../lib/alerts";
import { todayIST } from "../lib/time";
import { Icon } from "../components/Icon";
import { activeAlert, useLive } from "../state/LiveData";

export function Today() {
  useTitle("Today");
  const { home, status, alerts, refreshLive } = useLive();
  const now = useNow();
  const today = todayIST(now);
  const timeline = usePolling((signal) => getTimeline(today, { signal }), POLL_TIMELINE_MS, today);
  const [visitor, setVisitor] = useState<TimelineEvent | null>(null);
  const parentName = home.data?.parent_name;
  const open = activeAlert(status.data, alerts.data?.alerts);
  const { permission, requestPermission } = useNotifications();
  const [notifDismissed, setNotifDismissed] = useState(
    () => window.localStorage.getItem(NOTIFICATION_DISMISS_KEY) === "1",
  );

  return (
    <div className="flex flex-col gap-5">
      {status.data ? (
        <StatusCard status={status.data} now={now} />
      ) : status.error ? (
        <ErrorCard what="today's status" error={status.error} onRetry={status.refresh} />
      ) : (
        <Loading label="Loading today's status" lines={3} />
      )}

      {permission === "default" && !notifDismissed ? (
        <aside
          role="note"
          aria-label="Notification prompt"
          className="flex flex-col gap-3 rounded-xl bg-surface-2 px-4 py-3 text-sm sm:flex-row sm:items-center"
        >
          <p className="flex min-w-0 flex-1 items-center gap-2 font-medium">
            <Icon name="bell" className="h-5 w-5 shrink-0 text-muted" />
            Enable notifications to be alerted when something needs attention.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void requestPermission()}
              className="min-h-10 rounded-xl bg-accent px-4 font-semibold text-[15px] text-accent-ink transition hover:brightness-110"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem(NOTIFICATION_DISMISS_KEY, "1");
                setNotifDismissed(true);
              }}
              className="min-h-10 rounded-xl border border-line px-4 font-medium text-[15px] text-muted transition hover:bg-surface hover:text-ink"
            >
              Not now
            </button>
          </div>
        </aside>
      ) : null}

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
