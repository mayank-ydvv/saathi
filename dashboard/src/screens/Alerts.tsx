import type { Alert } from "../api/types";
import { Icon } from "../components/Icon";
import { Card, Empty, ErrorCard, Loading, PageTitle } from "../components/States";
import { Stepper } from "../components/Stepper";
import { isOpen, resolvedSummary } from "../lib/alerts";
import { kindLabel, zoneLabel } from "../lib/labels";
import { formatDateIST, formatTimeIST } from "../lib/time";
import { useTitle } from "../hooks/useTitle";
import { useLive } from "../state/LiveData";

export function Alerts() {
  useTitle("Alerts");
  const { home, alerts } = useLive();
  const parentName = home.data?.parent_name;

  return (
    <>
      <PageTitle sub="Every check-in Saathi started, newest first.">Alerts</PageTitle>
      {alerts.data ? (
        alerts.data.alerts.length ? (
          <ul className="flex flex-col gap-4">
            {alerts.data.alerts.map((a) => (
              <li key={a.alert_id}>
                <AlertCard alert={a} parentName={parentName} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No alerts yet">When something looks unusual, it will show up here.</Empty>
        )
      ) : alerts.error ? (
        <ErrorCard what="alerts" error={alerts.error} onRetry={alerts.refresh} />
      ) : (
        <Loading label="Loading alerts" lines={4} />
      )}
    </>
  );
}

function AlertCard({ alert, parentName }: { alert: Alert; parentName?: string }) {
  const open = isOpen(alert);
  const summary = resolvedSummary(alert);
  return (
    <Card className={open ? "ring-2 ring-bad-dot" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
            open ? "bg-bad-bg text-bad-ink" : "bg-ok-bg text-ok-ink"
          }`}
        >
          <Icon name={open ? "alert" : "check"} className="h-4 w-4" />
          {open ? "Open" : "Resolved"}
        </span>
        <span className="font-semibold">{kindLabel(alert.kind)}</span>
        {alert.zone ? <span className="text-muted">· {zoneLabel(alert.zone)}</span> : null}
        <time dateTime={alert.created_at} className="ml-auto text-sm text-muted">
          {formatDateIST(alert.created_at)}, {formatTimeIST(alert.created_at)}
        </time>
      </div>
      <p className="mt-3 text-lg leading-snug">{alert.reason}</p>
      <Stepper steps={alert.steps} parentName={parentName} />
      {summary ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-ok-bg px-3 py-2 font-medium text-ok-ink">
          <Icon name="check" className="h-4 w-4" />
          {summary}
        </p>
      ) : null}
    </Card>
  );
}
