import React, { useEffect, useState } from "react";
import { getDigest } from "../api/client";
import type { DigestResponse } from "../api/types";
import { IconBookOpen, IconCalendar, IconClock } from "../components/icons";
import { formatLocalTime } from "../utils/time";

export function DigestView(): React.ReactElement {
  const [selectedDate, setSelectedDate] = useState<string>("2026-10-22");
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const fetchDayDigest = async () => {
      setLoading(true);
      setIsNotFound(false);
      try {
        const res = await getDigest(undefined, selectedDate);
        if (!active) return;
        if (res.success) {
          setDigest(res.data);
          setIsNotFound(false);
        } else {
          // If status is 404 or failed
          setIsNotFound(true);
          setDigest(null);
        }
      } catch {
        if (active) setIsNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchDayDigest();
    return () => {
      active = false;
    };
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      {/* View Header with Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4 dark:border-stone-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Daily AI Digest
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Evening day-in-review synthesized from Ring motion, doorbell events, and routine rhythms.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="digest-date" className="text-xs font-semibold text-stone-500 sr-only">
            Select Date
          </label>
          <div className="relative">
            <input
              id="digest-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-800 shadow-xs dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Date Presets */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-medium text-stone-400">Jump to:</span>
        {[
          { label: "Today (22 Oct)", date: "2026-10-22" },
          { label: "Yesterday (21 Oct)", date: "2026-10-21" },
          { label: "20 Oct", date: "2026-10-20" },
        ].map((preset) => (
          <button
            key={preset.date}
            type="button"
            onClick={() => setSelectedDate(preset.date)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              selectedDate === preset.date
                ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Digest Content Card */}
      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-xs animate-pulse dark:border-stone-800 dark:bg-stone-900">
          <div className="h-4 w-32 bg-stone-200 rounded mb-4 dark:bg-stone-800" />
          <div className="h-6 w-3/4 bg-stone-200 rounded mb-2 dark:bg-stone-800" />
          <div className="h-6 w-full bg-stone-200 rounded mb-2 dark:bg-stone-800" />
          <div className="h-6 w-2/3 bg-stone-200 rounded dark:bg-stone-800" />
        </div>
      ) : isNotFound || !digest ? (
        /* Empty State: No digest yet */
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
            <IconClock className="w-7 h-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-stone-900 dark:text-stone-100">
            No digest yet — it arrives at 9 pm
          </h3>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            Amazon Bedrock synthesizes the entire day's events every evening at 21:00 IST to give your family a clear summary of your parent's day.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setSelectedDate("2026-10-22")}
              className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 transition-colors cursor-pointer"
            >
              View Today's Digest
            </button>
          </div>
        </div>
      ) : (
        /* Digest Display */
        <article className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-5 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <IconBookOpen className="w-5 h-5" />
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Amazon Bedrock Synthesis
                </span>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Evening Caregiver Digest
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <IconCalendar className="w-4 h-4" />
              <span>{digest.date}</span>
              <span className="text-stone-300 dark:text-stone-700">·</span>
              <span>Generated {formatLocalTime(digest.generated_at)} IST</span>
            </div>
          </div>

          <div className="pt-6">
            <p className="text-base sm:text-lg leading-relaxed text-stone-800 dark:text-stone-200 font-normal">
              "{digest.text}"
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400 dark:border-stone-800">
            <span>Delivered via Saathi Telegram Bot & Family Dashboard</span>
            <span className="font-mono text-[11px]">Model: Claude 3.5 Sonnet on AWS Bedrock</span>
          </div>
        </article>
      )}
    </div>
  );
}
