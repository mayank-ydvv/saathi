import React, { useEffect, useState } from "react";
import { getRoutine } from "../api/client";
import type { RoutineZone } from "../api/types";
import { IconClock } from "../components/icons";
import { RoutineChart } from "../components/RoutineChart";

export function RoutineView(): React.ReactElement {
  const [zones, setZones] = useState<RoutineZone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchRoutineData = async () => {
      setLoading(true);
      try {
        const res = await getRoutine();
        if (!active) return;
        if (res.success) {
          setZones(res.data.zones);
        } else {
          setError(res.error);
        }
      } catch {
        if (active) setError("Failed to load routine data");
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchRoutineData();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-stone-200 pb-4 dark:border-stone-800">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Learned Routines
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Saathi builds a 14-day 96-slot histogram per zone from Ring motion and doorbell events, learning normal morning start times and activity patterns.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-44 rounded-2xl bg-stone-100 dark:bg-stone-800" />
          <div className="h-44 rounded-2xl bg-stone-100 dark:bg-stone-800" />
        </div>
      ) : (
        <div className="space-y-5">
          {zones.map((zoneRoutine) => (
            <RoutineChart key={zoneRoutine.zone} routine={zoneRoutine} />
          ))}
        </div>
      )}

      <div className="rounded-xl bg-stone-50 p-4 text-xs text-stone-500 dark:bg-stone-800/40 dark:text-stone-400 flex items-start gap-2.5">
        <IconClock className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
        <p>
          <strong>How Saathi monitors rhythm:</strong> Each day is split into 96 15-minute slots. An anomaly fires if the usual morning start time passes without movement (plus buffer), if no motion is detected for 4 hours while awake, or if unexpected motion occurs at odd hours (e.g. 2:00 AM front door).
        </p>
      </div>
    </div>
  );
}
