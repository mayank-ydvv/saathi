/* eslint-disable react-refresh/only-export-components -- provider + its hook belong together */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { getAlerts, getHome, getStatus } from "../api/client";
import type { Alert, Home, Status } from "../api/types";
import { POLL_STATUS_MS } from "../config";
import { type Polled, usePolling } from "../hooks/usePolling";
import { startServerClockSync } from "../lib/clock";

interface LiveData {
  home: Polled<Home>;
  status: Polled<Status>;
  alerts: Polled<{ alerts: Alert[] }>;
  /** Re-fetch status and alerts now (after an ack). */
  refreshLive: () => void;
}

const LiveContext = createContext<LiveData | null>(null);

/** Polls status + alerts once for the whole app (every 5 s while visible); home once. */
export function LiveDataProvider({ children }: { children: ReactNode }) {
  useEffect(() => startServerClockSync(), []);
  const home = usePolling((signal) => getHome({ signal }), null);
  const status = usePolling((signal) => getStatus({ signal }), POLL_STATUS_MS);
  const alerts = usePolling((signal) => getAlerts(20, { signal }), POLL_STATUS_MS);
  const refreshStatus = status.refresh;
  const refreshAlerts = alerts.refresh;
  const value = useMemo(
    () => ({
      home,
      status,
      alerts,
      refreshLive: () => {
        refreshStatus();
        refreshAlerts();
      },
    }),
    [home, status, alerts, refreshStatus, refreshAlerts],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveData {
  const value = useContext(LiveContext);
  if (!value) throw new Error("useLive must be used inside <LiveDataProvider>");
  return value;
}

/** The open alert the status points at, if any. O(alerts). */
export function activeAlert(status: Status | null, alerts: Alert[] | undefined): Alert | null {
  if (!status?.active_alert_id || !alerts) return null;
  return alerts.find((a) => a.alert_id === status.active_alert_id) ?? null;
}
