import React, { useEffect } from "react";
import type { TimelineEvent } from "../api/types";
import { formatLocalTime, formatLocalDate } from "../utils/time";
import { IconAlertTriangle, IconCamera, IconClose, IconPackage, IconUser } from "./icons";

interface VisitorModalProps {
  event: TimelineEvent | null;
  onClose: () => void;
}

export function VisitorModal({ event, onClose }: VisitorModalProps): React.ReactElement | null {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!event) return null;

  const visitor = event.visitor;
  const isCaution = !!visitor?.caution;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="visitor-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-stone-200 dark:bg-stone-900 dark:border-stone-800 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <IconCamera className="w-4 h-4" />
            </span>
            <div>
              <h3 id="visitor-modal-title" className="text-base font-bold text-stone-900 dark:text-stone-100">
                Doorbell Visitor Snapshot
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Front Door · {formatLocalTime(event.ts)} ({formatLocalDate(event.ts)})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200 transition-colors"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Snapshot Image Area */}
        <div className="relative bg-stone-950 aspect-video flex items-center justify-center overflow-hidden">
          {event.snapshot_url ? (
            <img
              src={event.snapshot_url}
              alt="Ring doorbell snapshot capture"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-stone-500 text-xs">
              <IconCamera className="w-8 h-8 opacity-40" />
              <span>Snapshot capture unavailable</span>
            </div>
          )}

          {/* Timestamp overlay */}
          <div className="absolute bottom-3 left-3 rounded bg-black/75 px-2 py-0.5 text-[11px] font-mono text-white/90 backdrop-blur-xs">
            {formatLocalTime(event.ts)} IST · Ring Partner API
          </div>
        </div>

        {/* Visitor Analysis Content (from Bedrock) */}
        <div className="p-5 space-y-4">
          {/* Caution Alert Banner */}
          {isCaution && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-rose-950 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100">
              <div className="flex items-start gap-2.5">
                <IconAlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                    Caution Flag: Unrecognized Visitor
                  </h4>
                  <p className="mt-0.5 text-xs text-rose-800 dark:text-rose-300">
                    {visitor?.caution_reason || "Unidentified visitor without uniform or credentials."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Visitor Summary */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Bedrock Vision Summary
            </h4>
            <p className="mt-1 text-sm font-medium text-stone-800 dark:text-stone-200 leading-relaxed">
              {visitor ? visitor.summary : "No automated description generated for this event."}
            </p>
          </div>

          {/* Tags / Badges */}
          {visitor && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                <IconUser className="w-3.5 h-3.5 text-stone-500" />
                <span>{visitor.person_count} person{visitor.person_count > 1 ? "s" : ""}</span>
              </div>

              {visitor.uniform_or_badge ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  <span>Uniform / Badge verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-400">
                  <span>No uniform detected</span>
                </div>
              )}

              {visitor.carrying_package && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <IconPackage className="w-3.5 h-3.5 text-amber-700" />
                  <span>Parcel / Package</span>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
