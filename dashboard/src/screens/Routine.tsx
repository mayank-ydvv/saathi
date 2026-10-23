import { CalendarCheck, Clock3, House, Sunrise } from "lucide-react";
import { getRoutine } from "../api/client";
import { HelpNote } from "../components/HelpNote";
import { RoutineChart } from "../components/RoutineChart";
import { RoutineHeatmap } from "../components/RoutineHeatmap";
import { Block, Card, CardHeader, ErrorCard, PageTitle } from "../components/States";
import { Stat } from "../components/TodayStats";
import { BlurFade } from "../components/ui/motion";
import { usePolling } from "../hooks/usePolling";
import { useTitle } from "../hooks/useTitle";
import { zoneLabel } from "../lib/labels";
import { insights } from "../lib/routine";
import { zoneColour } from "../lib/zones";
import { useLive } from "../state/LiveData";

const WINDOW_DAYS = 14;

export function Routine() {
  useTitle("Routine");
  const { home } = useLive();
  const routine = usePolling((signal) => getRoutine({ signal }), null);
  const parent = home.data?.parent_name ?? "your parent";
  const zones = routine.data?.zones ?? [];
  const facts = insights(zones);
  const learning = routine.data ? facts.daysLearned < WINDOW_DAYS : false;

  return (
    <>
      <PageTitle sub={`When ${parent} is usually up and about, learned from the last 14 days.`}>Routine</PageTitle>
      {routine.data ? (
        <div className="flex flex-col gap-6">
          {learning ? (
            <p className="rounded-2xl bg-warn-bg px-4 py-3 font-medium text-warn-ink" role="status">
              Learning your parent's routine ({facts.daysLearned} of {WINDOW_DAYS} days)
            </p>
          ) : null}

          <section aria-label="Routine highlights" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={Sunrise} label="Usually up by" foot="First movement, any room">
              <p className="display text-[40px] leading-none font-semibold tabular-nums">{facts.upBy ?? "—"}</p>
            </Stat>
            <Stat icon={Clock3} label="Busiest hour" foot="Across all rooms">
              <p className="display text-[40px] leading-none font-semibold tabular-nums">
                {facts.busiestHour === null ? "—" : `${String(facts.busiestHour).padStart(2, "0")}:00`}
              </p>
            </Stat>
            <Stat icon={House} label="Most-used room" foot="Over the learned days">
              <p className="display text-[28px] leading-tight font-semibold">{facts.busiestZone ? zoneLabel(facts.busiestZone) : "—"}</p>
            </Stat>
            <Stat icon={CalendarCheck} label="Days learned">
              <p className="display text-[40px] leading-none font-semibold">
                {facts.daysLearned}
                <span className="text-xl text-muted">/{WINDOW_DAYS}</span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-ok-dot"
                  style={{ width: `${Math.min(100, (facts.daysLearned / WINDOW_DAYS) * 100)}%` }}
                />
              </div>
            </Stat>
          </section>

          <Card>
            <CardHeader title="A typical day" sub="How often each room is busy at each hour. Darker means more days." />
            <RoutineHeatmap zones={zones} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {zones.map((z, i) => (
              <BlurFade key={z.zone} delay={i * 0.05}>
                <Card className="lift h-full">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                      <span className="size-3 rounded-full" style={{ background: zoneColour(z.zone) }} aria-hidden="true" />
                      {zoneLabel(z.zone)}
                    </h2>
                    <p className="text-[15px] text-muted">
                      {z.usual_first ? (
                        <>
                          Usually first active at <strong className="font-bold text-ink">{z.usual_first}</strong>
                        </>
                      ) : (
                        "No usual time yet"
                      )}
                    </p>
                  </div>
                  <div className="mt-4">
                    <RoutineChart zone={z} />
                  </div>
                </Card>
              </BlurFade>
            ))}
          </div>
        </div>
      ) : routine.error ? (
        <ErrorCard what="the routine" error={routine.error} onRetry={routine.refresh} />
      ) : (
        <div role="status" aria-label="Loading the routine" className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Block key={i} className="h-36" />
            ))}
          </div>
          <Block className="h-64" />
        </div>
      )}

      <div className="mt-8">
        <HelpNote>
          <p>
            Saathi splits each day into 96 slots of 15 minutes and counts, for each room, how many of the last 14 days had
            movement in each slot. It also remembers when each room is usually first used and how much that varies.
          </p>
          <p>
            That's how it knows what "late" or "too quiet" means for {parent}: a late start is judged against the usual
            first activity plus a buffer, not a fixed clock time.
          </p>
        </HelpNote>
      </div>
    </>
  );
}
