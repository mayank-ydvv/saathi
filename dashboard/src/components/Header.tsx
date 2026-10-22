import React, { useEffect, useState } from "react";
import { formatLiveClock } from "../utils/time";
import { IconMapPin, IconUser } from "./icons";
import { setMockStatusOverride, getEffectiveMockStatusLevel, IS_MOCK_MODE } from "../api/client";
import type { StatusLevel } from "../api/types";

interface HeaderProps {
  parentName?: string;
  city?: string;
  onMockStatusChange?: (level: StatusLevel) => void;
}

export function Header({
  parentName = "Kamala",
  city = "Chennai",
  onMockStatusChange,
}: HeaderProps): React.ReactElement {
  const [clock, setClock] = useState<string>(() => formatLiveClock());
  const [activeMock, setActiveMock] = useState<StatusLevel>(() => getEffectiveMockStatusLevel());

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(formatLiveClock());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectMock = (level: StatusLevel) => {
    setMockStatusOverride(level);
    setActiveMock(level);
    if (onMockStatusChange) {
      onMockStatusChange(level);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-sm px-4 py-3 sm:px-6 dark:border-stone-800 dark:bg-stone-900/95 transition-colors">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        {/* Brand Wordmark and Elder Profile */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
              Saathi
            </span>
            <span className="text-[11px] font-medium tracking-wide uppercase text-stone-400 dark:text-stone-500">
              Elder Guardian
            </span>
          </div>

          <div className="h-6 w-px bg-stone-200 dark:bg-stone-800" aria-hidden="true" />

          <div className="flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
            <IconUser className="w-3.5 h-3.5 text-stone-500" />
            <span>{parentName}</span>
            <span className="text-stone-300 dark:text-stone-600">·</span>
            <IconMapPin className="w-3 h-3 text-stone-400" />
            <span>{city}</span>
          </div>
        </div>

        {/* Right side: Mock toggles (if mock mode) & Live Asia/Kolkata Clock */}
        <div className="flex items-center gap-3">
          {IS_MOCK_MODE && (
            <div
              className="hidden md:flex items-center gap-1 rounded-lg bg-stone-100 p-1 text-[11px] font-semibold dark:bg-stone-800"
              title="Demo Mode: Switch status variant for video recording"
            >
              <span className="px-1.5 text-stone-400 uppercase tracking-wider text-[10px]">
                Demo
              </span>
              <button
                type="button"
                onClick={() => handleSelectMock("green")}
                className={`rounded px-2 py-0.5 transition-colors ${
                  activeMock === "green"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => handleSelectMock("yellow")}
                className={`rounded px-2 py-0.5 transition-colors ${
                  activeMock === "yellow"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                }`}
              >
                Checking
              </button>
              <button
                type="button"
                onClick={() => handleSelectMock("red")}
                className={`rounded px-2 py-0.5 transition-colors ${
                  activeMock === "red"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                }`}
              >
                Alert
              </button>
            </div>
          )}

          <div
            className="flex items-center gap-1.5 rounded-md border border-stone-200/80 bg-stone-50 px-2.5 py-1 text-xs font-mono text-stone-600 dark:border-stone-800 dark:bg-stone-800/80 dark:text-stone-300"
            aria-label={`Local time in Chennai: ${clock}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{clock}</span>
            <span className="text-[10px] text-stone-400 font-sans">IST</span>
          </div>
        </div>
      </div>
    </header>
  );
}
