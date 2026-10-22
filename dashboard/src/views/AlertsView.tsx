import React, { useCallback, useState } from "react";
import { getAlerts } from "../api/client";
import type { Alert } from "../api/types";
import { AlertStepper } from "../components/AlertStepper";
import { IconAlertTriangle, IconCheckCircle } from "../components/icons";
import { usePolling } from "../hooks/usePolling";

export function AlertsView(): React.ReactElement {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlertsList = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await getAlerts(undefined, 20, signal);
      if (res.success) {
        setAlerts(res.data.alerts);
        setError(null);
      } else {
        setError(res.error);
      }
    } catch {
      // Swallowed on abort
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchAlertsList, 5000);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-4 dark:border-stone-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Alerts & Escalations
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Step-by-step history of routine deviations and caregiver resolutions.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Polling (every 5s)</span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              void fetchAlertsList();
            }}
            className="rounded px-2.5 py-1 bg-rose-600 text-white font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {loading && alerts.length === 0 ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-40 rounded-2xl bg-stone-100 dark:bg-stone-800" />
          <div className="h-40 rounded-2xl bg-stone-100 dark:bg-stone-800" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <IconCheckCircle className="w-6 h-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-stone-900 dark:text-stone-100">
            No Alerts Recorded
          </h3>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
            Your parent's daily activity has followed established rhythms with no unresolved anomalies.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {alerts.map((alert) => (
            <AlertStepper key={alert.alert_id} alert={alert} />
          ))}
        </div>
      )}

      <div className="rounded-xl bg-stone-50 p-4 text-xs text-stone-500 dark:bg-stone-800/40 dark:text-stone-400 flex items-start gap-3">
        <IconAlertTriangle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
        <p>
          Escalations progress strictly: <strong>Suspect</strong> (10-300s grace period) →{" "}
          <strong>Nudge Parent</strong> (Amazon Polly audio prompt + I'm okay button) →{" "}
          <strong>Alert Family</strong> (Telegram & dashboard notification) →{" "}
          <strong>Alert Neighbour</strong>. Any single acknowledgement immediately marks the alert <strong>Resolved</strong>.
        </p>
      </div>
    </div>
  );
}
