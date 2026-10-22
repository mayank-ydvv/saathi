import React from "react";
import type { Status, StatusLevel } from "../api/types";
import { formatRelativeTime } from "../utils/time";
import { IconAlertCircle, IconAlertTriangle, IconCheckCircle } from "./icons";

interface StatusCardProps {
  status: Status | null;
  loading?: boolean;
}

function formatZoneName(zone: string): string {
  switch (zone.toLowerCase()) {
    case "kitchen":
      return "Kitchen";
    case "living_room":
      return "Living Room";
    case "front_door":
      return "Front Door";
    case "bedroom":
      return "Bedroom";
    default:
      return zone.replace(/_/g, " ");
  }
}

export function StatusCard({ status, loading = false }: StatusCardProps): React.ReactElement {
  if (loading && !status) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs animate-pulse dark:border-stone-800 dark:bg-stone-900">
        <div className="h-6 w-32 bg-stone-200 rounded-md dark:bg-stone-800" />
        <div className="mt-4 h-8 w-64 bg-stone-200 rounded-md dark:bg-stone-800" />
        <div className="mt-3 h-4 w-48 bg-stone-100 rounded-md dark:bg-stone-800" />
      </div>
    );
  }

  const level: StatusLevel = status?.status || "green";

  const config = {
    green: {
      title: "All normal",
      badgeText: "Normal Rhythm",
      defaultReason: "Activity follows your parent's expected daily pattern.",
      bgClass: "bg-emerald-50/80 border-emerald-200/90 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-50",
      badgeBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700",
      icon: <IconCheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      dotClass: "bg-emerald-500",
    },
    yellow: {
      title: "Checking in",
      badgeText: "Grace Period",
      defaultReason: "Saathi noticed an activity change and is verifying before alerting.",
      bgClass: "bg-amber-50/90 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-50",
      badgeBg: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700",
      icon: <IconAlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400 shrink-0" />,
      dotClass: "bg-amber-500 animate-ping",
    },
    red: {
      title: "Needs attention",
      badgeText: "Active Escalation",
      defaultReason: "Expected routine not detected. Please verify with your parent.",
      bgClass: "bg-rose-50/90 border-rose-200 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-50",
      badgeBg: "bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200 border border-rose-300 dark:border-rose-700",
      icon: <IconAlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400 shrink-0" />,
      dotClass: "bg-rose-500 animate-ping",
    },
  }[level];

  const reasonText = status?.reason || config.defaultReason;

  const lastSeenDisplay = status?.last_seen
    ? `Last seen: ${formatZoneName(status.last_seen.zone)} · ${formatRelativeTime(status.last_seen.ts)}`
    : "No recent activity recorded today";

  return (
    <section
      aria-live="polite"
      aria-label={`Home Status: ${config.title}`}
      className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 shadow-xs transition-all ${config.bgClass}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="mt-1">{config.icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {config.title}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.badgeBg}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
                {config.badgeText}
              </span>
            </div>
            <p className="mt-1.5 text-base sm:text-lg font-medium opacity-90 max-w-2xl">
              {reasonText}
            </p>
          </div>
        </div>

        <div className="self-start sm:self-auto shrink-0 rounded-xl bg-white/70 backdrop-blur-xs px-3.5 py-2 text-xs sm:text-sm font-medium border border-black/5 dark:bg-black/20 dark:border-white/10">
          <span className="opacity-75">{lastSeenDisplay}</span>
        </div>
      </div>
    </section>
  );
}
