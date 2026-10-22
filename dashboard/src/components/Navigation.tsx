import React from "react";
import { Link, useLocation } from "react-router-dom";
import { IconActivity, IconAlertTriangle, IconBookOpen, IconClock } from "./icons";

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: (active: boolean) => React.ReactElement;
  badge?: number;
}

interface NavigationProps {
  alertCount?: number;
}

export function Navigation({ alertCount = 0 }: NavigationProps): React.ReactElement {
  const location = useLocation();

  const items: NavItem[] = [
    {
      id: "today",
      label: "Today",
      path: "/",
      icon: (active) => (
        <IconActivity
          className={`w-5 h-5 transition-colors ${
            active ? "text-emerald-700 dark:text-emerald-400" : "text-stone-400 dark:text-stone-500"
          }`}
        />
      ),
    },
    {
      id: "alerts",
      label: "Alerts",
      path: "/alerts",
      badge: alertCount,
      icon: (active) => (
        <IconAlertTriangle
          className={`w-5 h-5 transition-colors ${
            active ? "text-emerald-700 dark:text-emerald-400" : "text-stone-400 dark:text-stone-500"
          }`}
        />
      ),
    },
    {
      id: "digest",
      label: "Digest",
      path: "/digest",
      icon: (active) => (
        <IconBookOpen
          className={`w-5 h-5 transition-colors ${
            active ? "text-emerald-700 dark:text-emerald-400" : "text-stone-400 dark:text-stone-500"
          }`}
        />
      ),
    },
    {
      id: "routine",
      label: "Routine",
      path: "/routine",
      icon: (active) => (
        <IconClock
          className={`w-5 h-5 transition-colors ${
            active ? "text-emerald-700 dark:text-emerald-400" : "text-stone-400 dark:text-stone-500"
          }`}
        />
      ),
    },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {/* Desktop Side Navigation */}
      <nav
        aria-label="Desktop Navigation"
        className="hidden md:flex flex-col w-56 shrink-0 border-r border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="space-y-1.5">
          {items.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                  active
                    ? "bg-emerald-50 text-emerald-900 shadow-xs dark:bg-emerald-950/60 dark:text-emerald-100"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon(active)}
                  <span>{item.label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="mt-auto pt-6 border-t border-stone-100 dark:border-stone-800">
          <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
            <span className="font-semibold block text-stone-700 dark:text-stone-300">
              Caretaker View
            </span>
            <span>Real-time Ring guardian monitoring for family peace of mind.</span>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur-md px-2 py-1.5 dark:border-stone-800 dark:bg-stone-900/95"
      >
        <div className="flex items-center justify-around">
          {items.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[11px] font-medium transition-colors relative ${
                  active
                    ? "text-emerald-800 dark:text-emerald-400 font-semibold"
                    : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
                }`}
              >
                <div className="relative">
                  {item.icon(active)}
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <span className="mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
