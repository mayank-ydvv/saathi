import { BellOff, BellRing, CircleCheck, Moon, Sunrise, Timer, TriangleAlert, ZapOff, type LucideIcon } from "lucide-react";
import { useState } from "react";
import type { Alert } from "../api/types";
import { HelpNote } from "../components/HelpNote";
import { Block, Card, Empty, ErrorCard, PageTitle } from "../components/States";
import { Stepper } from "../components/Stepper";
import { Stat } from "../components/TodayStats";
import { BlurFade } from "../components/ui/motion";
import { useNow } from "../hooks/useNow";
import { useTitle } from "../hooks/useTitle";
import { isOpen, resolvedSummary } from "../lib/alerts";
import { cn } from "../lib/cn";
import { kindLabel, zoneLabel } from "../lib/labels";
import { dateKeyIST, formatDateIST, formatDuration, formatTimeIST, minutesBetween, todayIST } from "../lib/time";
import { useLive } from "../state/LiveData";

type Filter = "all" | "open" | "resolved";

const KIND_ICON: Record<string, LucideIcon> = { late_start: Sunrise, long_inactivity: ZapOff, night_activity: Moon };

/** Average minutes from an alert opening to someone answering, or null if none resolved. O(n). */
function averageResponse(alerts: Alert[]): number | null {
  const done = alerts.filter((a) => a.resolved_at);
  if (!done.length) return null;
  const total = done.reduce((sum, a) => sum + minutesBetween(a.created_at, a.resolved_at ?? a.created_at), 0);
  return Math.round(total / done.length);
}

/** Alerts (already newest first) grouped by their IST day, keeping that order. O(n). */
function byDay(alerts: Alert[]): [string, Alert[]][] {
  const groups = new Map<string, Alert[]>();
  for (const a of alerts) {
    const key = dateKeyIST(a.created_at);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.entries()];
}

export function Alerts() {
  useTitle("Alerts");
  const { home, alerts } = useLive();
  const now = useNow();
  const today = todayIST(now);
  const parentName = home.data?.parent_name;
  const [filter, setFilter] = useState<Filter>("all");
  const list = alerts.data?.alerts ?? [];
  const openCount = list.filter(isOpen).length;
  const avg = averageResponse(list);
  const shown = list.filter((a) => (filter === "all" ? true : filter === "open" ? isOpen(a) : !isOpen(a)));

  return (
    <>
      <PageTitle sub="Every check-in Saathi started, who it reached, and who answered.">Alerts</PageTitle>

      <section aria-label="Alerts summary" className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={BellRing} label="All alerts" foot="The last 20">
          <p className="display text-[40px] leading-none font-semibold">{alerts.data ? list.length : "—"}</p>
        </Stat>
        <Stat icon={TriangleAlert} label="Open now" foot={openCount ? "Needs someone to check" : "Nothing waiting"}>
          <p className={cn("display text-[40px] leading-none font-semibold", openCount && "text-bad-ink")}>{alerts.data ? openCount : "—"}</p>
        </Stat>
        <Stat icon={CircleCheck} label="Resolved">
          <p className="display text-[40px] leading-none font-semibold">{alerts.data ? list.length - openCount : "—"}</p>
        </Stat>
        <Stat icon={Timer} label="Average response" foot="From the alert to the first answer">
          <p className="display text-[40px] leading-none font-semibold">
            {avg === null ? "—" : avg < 1 ? "<1 min" : formatDuration(avg)}
          </p>
        </Stat>
      </section>

      <div role="group" aria-label="Show alerts" className="mb-5 inline-flex rounded-xl border border-line bg-surface p-1 shadow-card">
        {(
          [
            ["all", "All", list.length],
            ["open", "Open", openCount],
            ["resolved", "Resolved", list.length - openCount],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "press inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[15px] font-semibold transition-colors",
              filter === value ? "bg-accent text-accent-ink" : "text-muted hover:text-ink",
            )}
          >
            {label}
            <span className={cn("rounded-full px-1.5 text-xs leading-5", filter === value ? "bg-white/20" : "bg-surface-2")}>{count}</span>
          </button>
        ))}
      </div>

      {alerts.data ? (
        shown.length ? (
          <div className="flex flex-col gap-8">
            {byDay(shown).map(([day, items]) => (
              <section key={day} aria-label={formatDateIST(items[0]?.created_at ?? day)}>
                <h2 className="mb-3 text-lg font-semibold text-muted">
                  {day === today ? "Today" : formatDateIST(items[0]?.created_at ?? day)}
                </h2>
                <ul className="flex flex-col gap-4">
                  {items.map((a, i) => (
                    <li key={a.alert_id}>
                      <BlurFade delay={i * 0.05}>
                        <AlertCard alert={a} parentName={parentName} />
                      </BlurFade>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <Empty title={list.length ? "Nothing in this view" : "No alerts yet"} icon={BellOff}>
            {list.length ? "Try another filter." : "When something looks unusual, it will show up here."}
          </Empty>
        )
      ) : alerts.error ? (
        <ErrorCard what="alerts" error={alerts.error} onRetry={alerts.refresh} />
      ) : (
        <div role="status" aria-label="Loading alerts" className="flex flex-col gap-4">
          <Block className="h-48" />
          <Block className="h-48" />
        </div>
      )}

      <div className="mt-8">
        <HelpNote>
          <p>
            An alert starts when the day doesn't look normal: a <strong>late start</strong> (no kitchen or bedroom
            movement well past the usual time), a <strong>long quiet spell</strong> (four hours without movement while
            awake), or <strong>night activity</strong> (the front door at an hour it's rarely used).
          </p>
          <p>
            It then climbs one step at a time: Saathi waits a few minutes, asks {parentName ?? "your parent"} with a voice
            nudge, alerts the family on Telegram, and finally the neighbour. Any answer at any step resolves it.
          </p>
          <p>Each kind of alert fires at most once a day.</p>
        </HelpNote>
      </div>
    </>
  );
}

function AlertCard({ alert, parentName }: { alert: Alert; parentName?: string }) {
  const open = isOpen(alert);
  const summary = resolvedSummary(alert);
  const KindIcon = KIND_ICON[alert.kind] ?? BellRing;
  return (
    <Card className={cn("lift", open && "ring-2 ring-bad-dot")}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("grid size-11 place-items-center rounded-xl", open ? "bg-bad-bg text-bad-ink" : "bg-surface-2 text-ink")}>
          <KindIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">
            {kindLabel(alert.kind)}
            {alert.zone ? <span className="font-normal text-muted"> · {zoneLabel(alert.zone)}</span> : null}
          </p>
          <time dateTime={alert.created_at} className="text-sm text-muted">
            Started {formatTimeIST(alert.created_at)}
          </time>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
            open ? "bg-bad-bg text-bad-ink" : "bg-ok-bg text-ok-ink",
          )}
        >
          {open ? <TriangleAlert className="size-4" aria-hidden="true" /> : <CircleCheck className="size-4" aria-hidden="true" />}
          {open ? "Open" : "Resolved"}
        </span>
      </div>
      <p className="mt-4 text-[17px] leading-snug">{alert.reason}</p>
      <Stepper steps={alert.steps} parentName={parentName} />
      {summary ? (
        <p className="mt-5 flex items-center gap-2 rounded-xl bg-ok-bg px-3 py-2 font-medium text-ok-ink">
          <Timer className="size-4 shrink-0" aria-hidden="true" />
          <span>{summary}</span>
        </p>
      ) : null}
    </Card>
  );
}
