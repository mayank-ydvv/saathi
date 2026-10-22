import React from "react";
import type { Alert } from "../api/types";
import { formatDurationBetween, formatLocalTime, formatLocalDate } from "../utils/time";
import { IconAlertTriangle, IconCheckCircle, IconClock } from "./icons";

interface AlertStepperProps {
  alert: Alert;
}

function getStepDetails(stepKey: string): { label: string; description: string } {
  switch (stepKey) {
    case "SUSPECT":
      return {
        label: "Grace Period (Suspect)",
        description: "Activity gap flagged; awaiting natural catch-up before reaching out.",
      };
    case "NUDGE_PARENT":
      return {
        label: "Voice Prompt & Parent App",
        description: "Spoken prompt sent via Amazon Polly; 'I'm okay' button active.",
      };
    case "ALERT_FAMILY":
      return {
        label: "Family Telegram Alert",
        description: "Urgent notification and checking request sent to family group.",
      };
    case "ALERT_NEIGHBOUR":
      return {
        label: "Neighbour Contact Alert",
        description: "Local emergency contact contacted for physical door check.",
      };
    case "RESOLVED":
      return {
        label: "Resolved",
        description: "Check-in confirmed and escalation closed.",
      };
    default:
      return {
        label: stepKey.replace(/_/g, " "),
        description: "",
      };
  }
}

export function AlertStepper({ alert }: AlertStepperProps): React.ReactElement {
  const isResolved = alert.state === "RESOLVED";

  const resolvedDuration =
    alert.resolved_at && alert.created_at
      ? formatDurationBetween(alert.created_at, alert.resolved_at)
      : null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs dark:border-stone-800 dark:bg-stone-900 transition-all">
      {/* Alert Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-stone-100 pb-4 dark:border-stone-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                isResolved
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
              }`}
            >
              {isResolved ? (
                <IconCheckCircle className="w-4 h-4" />
              ) : (
                <IconAlertTriangle className="w-4 h-4" />
              )}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              {alert.kind.replace(/_/g, " ")} {alert.zone ? `· ${alert.zone.replace(/_/g, " ")}` : ""}
            </span>
          </div>
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            {alert.reason}
          </h3>
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <IconClock className="w-3.5 h-3.5 text-stone-400" />
            <span>
              Started {formatLocalTime(alert.created_at)} ({formatLocalDate(alert.created_at)})
            </span>
          </div>
        </div>

        {/* State Badge */}
        <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase ${
              isResolved
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse"
            }`}
          >
            {alert.state.replace(/_/g, " ")}
          </span>

          {isResolved && alert.acked_by && (
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
              Resolved by <strong>{alert.acked_by.name}</strong>
              {resolvedDuration ? ` in ${resolvedDuration}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Vertical Stepper */}
      <div className="pt-5 pl-2 sm:pl-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-4 dark:text-stone-500">
          Escalation Ladder History
        </h4>

        <div className="relative border-l-2 border-stone-200 ml-3 dark:border-stone-800 space-y-6">
          {alert.steps.map((step, idx) => {
            const isLast = idx === alert.steps.length - 1;
            const details = getStepDetails(step.state);
            const isStepResolved = step.state === "RESOLVED";

            return (
              <div key={`${step.state}-${step.at}-${idx}`} className="relative pl-6">
                {/* Node dot */}
                <div
                  className={`absolute -left-[9px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white dark:ring-stone-900 ${
                    isStepResolved
                      ? "bg-emerald-600"
                      : isLast && !isResolved
                      ? "bg-rose-600 animate-ping"
                      : "bg-stone-400 dark:bg-stone-600"
                  }`}
                />

                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                    {details.label}
                  </div>
                  <div className="text-xs font-mono text-stone-400 dark:text-stone-500">
                    {formatLocalTime(step.at)} IST
                  </div>
                </div>

                {details.description && (
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                    {details.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
