import { NavLink, Outlet } from "react-router-dom";
import { config } from "../config";
import { useNow } from "../hooks/useNow";
import { formatDateIST, formatTimeIST } from "../lib/time";
import { useLive } from "../state/LiveData";
import { FamilyName } from "./FamilyName";
import { Icon, type IconName } from "./Icon";

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Today", icon: "today" },
  { to: "/alerts", label: "Alerts", icon: "bell" },
  { to: "/digest", label: "Digest", icon: "book" },
  { to: "/routine", label: "Routine", icon: "chart" },
];

function Tab({ to, label, icon, compact }: (typeof TABS)[number] & { compact?: boolean }) {
  return (
    <NavLink
      to={{ pathname: to, search: window.location.search }}
      end={to === "/"}
      className={({ isActive }) =>
        [
          "flex items-center rounded-xl font-medium transition-colors",
          compact ? "flex-1 flex-col gap-0.5 px-1 py-2 text-xs" : "gap-3 px-3 py-2.5 text-[15px]",
          isActive ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
        ].join(" ")
      }
    >
      <Icon name={icon} className={compact ? "h-6 w-6" : "h-5 w-5"} />
      {label}
    </NavLink>
  );
}

export function Layout() {
  const { home } = useLive();
  const now = useNow(1_000);
  const parent = home.data;

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-line px-4 py-6 md:flex">
        <Wordmark />
        <nav aria-label="Main" className="flex flex-col gap-1">
          {TABS.map((t) => (
            <Tab key={t.to} {...t} />
          ))}
        </nav>
        <div className="mt-auto">
          <FamilyName />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-8">
            <div className="md:hidden">
              <Wordmark />
            </div>
            <div className="min-w-0 flex-1 md:flex-none">
              <p className="truncate text-[15px] font-semibold">
                {parent ? `${parent.parent_name} · ${parent.city}` : " "}
              </p>
              <p className="hidden text-sm text-muted sm:block">{formatDateIST(now)}</p>
            </div>
            <div className="ml-auto text-right">
              <time
                dateTime={now.toISOString()}
                className="block text-lg font-semibold tabular-nums"
                aria-label={`Time in Chennai ${formatTimeIST(now)}`}
              >
                {formatTimeIST(now)}
              </time>
              <p className="text-xs text-muted">IST{config.useMock ? " · demo data" : ""}</p>
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 flex gap-1 border-t border-line bg-surface/95 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {TABS.map((t) => (
          <Tab key={t.to} {...t} compact />
        ))}
      </nav>
    </div>
  );
}

function Wordmark() {
  return (
    <p className="flex items-center gap-2 text-xl font-bold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-accent-ink">
        <Icon name="shield" className="h-4.5 w-4.5" />
      </span>
      Saathi
    </p>
  );
}
