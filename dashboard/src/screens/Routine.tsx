import { getRoutine } from "../api/client";
import { RoutineChart } from "../components/RoutineChart";
import { Card, ErrorCard, Loading, PageTitle } from "../components/States";
import { useTitle } from "../hooks/useTitle";
import { usePolling } from "../hooks/usePolling";
import { zoneLabel } from "../lib/labels";
import { useLive } from "../state/LiveData";

const WINDOW_DAYS = 14;

export function Routine() {
  useTitle("Routine");
  const { home } = useLive();
  const routine = usePolling((signal) => getRoutine({ signal }), null);
  const parent = home.data?.parent_name ?? "your parent";
  const learning = routine.data?.zones.some((z) => z.days_seen < WINDOW_DAYS);
  const daysSeen = Math.min(...(routine.data?.zones.map((z) => z.days_seen) ?? [0]));

  return (
    <>
      <PageTitle sub={`When ${parent} is usually active, learned from the last 14 days.`}>Routine</PageTitle>
      {routine.data ? (
        <div className="flex flex-col gap-4">
          {learning ? (
            <p className="rounded-2xl bg-warn-bg px-4 py-3 font-medium text-warn-ink" role="status">
              Learning your parent's routine ({daysSeen} of {WINDOW_DAYS} days)
            </p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {routine.data.zones.map((z) => (
              <Card key={z.zone}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">{zoneLabel(z.zone)}</h2>
                  <p className="text-[15px] text-muted">
                    {z.usual_first ? (
                      <>
                        Usually first active at <strong className="font-semibold text-ink">{z.usual_first}</strong>
                      </>
                    ) : (
                      "No usual time yet"
                    )}
                  </p>
                </div>
                <div className="mt-3">
                  <RoutineChart zone={z} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : routine.error ? (
        <ErrorCard what="the routine" error={routine.error} onRetry={routine.refresh} />
      ) : (
        <Loading label="Loading the routine" lines={4} />
      )}
    </>
  );
}
