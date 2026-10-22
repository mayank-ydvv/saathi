import React, { useCallback, useState } from "react";
import { getAlerts, getStatus, getTimeline } from "../api/client";
import type { Alert, Status, TimelineEvent } from "../api/types";
import { ActiveAlertBanner } from "../components/ActiveAlertBanner";
import { StatusCard } from "../components/StatusCard";
import { TimelineLanes } from "../components/TimelineLanes";
import { VisitorModal } from "../components/VisitorModal";
import { usePolling } from "../hooks/usePolling";

export function TodayView(): React.ReactElement {
  const [status, setStatus] = useState<Status | null>(null);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [selectedVisitorEvent, setSelectedVisitorEvent] = useState<TimelineEvent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Poll status & alerts every 5 seconds (visibility-aware)
  const fetchStatusAndAlerts = useCallback(async (signal?: AbortSignal) => {
    try {
      const [statusRes, alertsRes] = await Promise.all([
        getStatus(undefined, signal),
        getAlerts(undefined, 5, signal),
      ]);

      if (statusRes.success) {
        setStatus(statusRes.data);
      } else {
        setError(statusRes.error);
      }

      if (alertsRes.success) {
        const openAlert = alertsRes.data.alerts.find((a) => a.state !== "RESOLVED") || null;
        setActiveAlert(openAlert);
      }
    } catch {
      // Swallowed on abort
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchStatusAndAlerts, 5000);

  // Poll timeline every 30 seconds
  const fetchTimeline = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await getTimeline(undefined, "2026-10-22", signal);
      if (res.success) {
        setTimelineEvents(res.data.events);
      }
    } catch {
      // Swallowed on abort
    }
  }, []);

  usePolling(fetchTimeline, 30000);

  const handleAlertAcknowledged = () => {
    // Immediately re-fetch status & alerts
    void fetchStatusAndAlerts();
  };

  return (
    <div className="space-y-6">
      {/* Error Banner with Retry */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              void fetchStatusAndAlerts();
              void fetchTimeline();
            }}
            className="rounded px-2.5 py-1 bg-rose-600 text-white font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Status Card */}
      <StatusCard status={status} loading={loading} />

      {/* Prominent Active Escalation Banner */}
      {activeAlert && (
        <ActiveAlertBanner
          alert={activeAlert}
          onAlertAcknowledged={handleAlertAcknowledged}
        />
      )}

      {/* 24-Hour Timeline */}
      <TimelineLanes
        events={timelineEvents}
        onSelectEvent={(ev) => {
          if (ev.visitor || ev.snapshot_url || ev.type === "ding") {
            setSelectedVisitorEvent(ev);
          }
        }}
        selectedEventId={selectedVisitorEvent?.event_id}
      />

      {/* Visitor Snapshot Modal */}
      <VisitorModal
        event={selectedVisitorEvent}
        onClose={() => setSelectedVisitorEvent(null)}
      />
    </div>
  );
}
