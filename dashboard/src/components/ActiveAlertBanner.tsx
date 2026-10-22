import React, { useState } from "react";
import type { Alert } from "../api/types";
import { ackAlert } from "../api/client";
import { IconAlertTriangle, IconCheckCircle } from "./icons";
import { formatLocalTime } from "../utils/time";

interface ActiveAlertBannerProps {
  alert: Alert | null;
  onAlertAcknowledged: () => void;
}

const STEP_ORDER: Array<{ key: string; label: string }> = [
  { key: "SUSPECT", label: "Grace Period" },
  { key: "NUDGE_PARENT", label: "Spoken Nudge" },
  { key: "ALERT_FAMILY", label: "Family Alert" },
  { key: "ALERT_NEIGHBOUR", label: "Neighbour Alert" },
];

export function ActiveAlertBanner({
  alert,
  onAlertAcknowledged,
}: ActiveAlertBannerProps): React.ReactElement | null {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!alert || alert.state === "RESOLVED") {
    return null;
  }

  const handleAck = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await ackAlert(alert.alert_id, {
        by: "family",
        name: "Anushka",
      });
      if (res.success) {
        onAlertAcknowledged();
      } else {
        setErrorMessage(res.error || "Failed to acknowledge alert");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error submitting acknowledgment");
    } finally {
      setSubmitting(false);
    }
  };

  const currentStepIndex = STEP_ORDER.findIndex((s) => s.key === alert.state);

  return (
    <div className="rounded-2xl border-2 border-rose-500 bg-rose-50/95 p-5 shadow-md dark:border-rose-600 dark:bg-rose-950/60 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white">
              <IconAlertTriangle className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              Active Escalation · Action Needed
            </span>
            <span className="text-xs text-rose-600 dark:text-rose-400">
              Started {formatLocalTime(alert.created_at)}
            </span>
          </div>

          <div>
            <h3 className="text-xl font-bold text-rose-950 dark:text-rose-100">
              {alert.reason}
            </h3>
            <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-300 mt-0.5">
              Current stage: <strong className="font-semibold">{alert.state.replace(/_/g, " ")}</strong>. Please check in with your parent.
            </p>
          </div>

          {/* Stepper overview */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {STEP_ORDER.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step.key} className="flex items-center gap-1.5 text-xs">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      isCurrent
                        ? "bg-rose-600 text-white ring-2 ring-rose-300 animate-pulse"
                        : isPast
                        ? "bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-300"
                        : "bg-stone-200 text-stone-500 dark:bg-stone-800 dark:text-stone-500"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className={`font-medium ${
                      isCurrent
                        ? "text-rose-950 dark:text-rose-100 font-bold"
                        : isPast
                        ? "text-rose-800 dark:text-rose-300 line-through opacity-75"
                        : "text-stone-400 dark:text-stone-500"
                    }`}
                  >
                    {step.label}
                  </span>
                  {idx < STEP_ORDER.length - 1 && (
                    <span className="text-stone-300 dark:text-stone-700">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={handleAck}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-sm hover:bg-rose-700 active:scale-98 focus:outline-hidden focus:ring-4 focus:ring-rose-300 disabled:opacity-50 transition-all cursor-pointer"
          >
            {submitting ? (
              <span className="inline-block animate-spin">⏳</span>
            ) : (
              <IconCheckCircle className="w-5 h-5" />
            )}
            <span>I'm checking</span>
          </button>
          <span className="text-[11px] text-center sm:text-right text-rose-700 dark:text-rose-400">
            Resolves escalation and notifies the family
          </span>
          {errorMessage && (
            <span className="text-xs font-semibold text-rose-900 bg-rose-200/80 px-2 py-1 rounded">
              {errorMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
