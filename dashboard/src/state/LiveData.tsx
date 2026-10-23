/* eslint-disable react-refresh/only-export-components -- provider + its hook belong together */
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { getAlerts, getHome, getStatus } from "../api/client";
import type { Alert, Home, Status, StatusColour } from "../api/types";
import { POLL_STATUS_MS } from "../config";
import { useNotifications } from "../hooks/useNotifications";
import { useMockVariant } from "../hooks/useMockVariant";
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
  useOnChange(useMockVariant()[0], () => {
    refreshStatus();
    refreshAlerts();
  });
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

  // A browser notification when the day escalates to red, even with the tab in the background.
  const { notify } = useNotifications();
  const prevColour = useRef<StatusColour | null>(null);
  useEffect(() => {
    const colour = status.data?.status ?? null;
    const was = prevColour.current;
    prevColour.current = colour;
    if (colour !== "red" || (was !== "green" && was !== "yellow")) return;
    const parent = home.data?.parent_name;
    const reason =
      status.data?.reason ?? activeAlert(status.data, alerts.data?.alerts)?.reason ?? null;
    void notify(parent ? `${parent} needs attention` : "Saathi needs attention", {
      body: reason ?? "Someone should check in.",
      tag: status.data?.active_alert_id ?? "saathi",
    });
  }, [status.data, alerts.data, home.data, notify]);

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

/** Run `effect` when `value` changes (not on mount). */
export function useOnChange<T>(value: T, effect: () => void): void {
  const first = useRef(true);
  const latest = useRef(effect);
  latest.current = effect;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    latest.current();
  }, [value]);
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
