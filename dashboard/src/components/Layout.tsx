import { Activity, BellRing, BookOpen, ChartColumn, DoorOpen, LogOut, Users, type LucideIcon } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut, useSession } from "../auth/session";
import { config } from "../config";
import { useNow } from "../hooks/useNow";
import { isOpen } from "../lib/alerts";
import { cn } from "../lib/cn";
import { FAMILY } from "../lib/family";
import { statusLook } from "../lib/labels";
import { formatDateIST, formatTimeIST, TIMEZONE } from "../lib/time";
import { useLive } from "../state/LiveData";
import { CallLink } from "./CallLink";
import { DemoSwitch } from "./DemoSwitch";
import { FamilyName } from "./FamilyName";
import { MobileAckBar } from "./MobileAckBar";
import { ThemeToggle } from "./ui/ThemeToggle";

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Today", icon: Activity },
  { to: "/alerts", label: "Alerts", icon: BellRing },
  { to: "/visitors", label: "Visitors", icon: DoorOpen },
  { to: "/digest", label: "Digest", icon: BookOpen },
  { to: "/routine", label: "Routine", icon: ChartColumn },
  { to: "/family", label: "Family", icon: Users },
];

const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "numeric", hourCycle: "h23" });

function greeting(now: Date): string {
  const hour = Number(hourFmt.format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Tab({ to, label, icon: IconCmp, compact, badge }: (typeof TABS)[number] & { compact?: boolean; badge: number }) {
  const { search } = useLocation(); // keep ?mock= / ?time= when switching tabs
  return (
    <NavLink
      to={{ pathname: to, search }}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "press relative flex items-center rounded-xl font-medium transition-colors",
          compact ? "flex-1 flex-col gap-0.5 px-1 py-1.5 text-[11px]" : "gap-3 px-3 py-2.5 text-[16px]",
          isActive ? "bg-surface text-ink shadow-card" : "text-muted hover:bg-surface/60 hover:text-ink",
        )
      }
    >
      <span className="relative">
        <IconCmp className={compact ? "size-[22px]" : "size-5"} aria-hidden="true" />
        {badge && compact ? (
          <span className="absolute -top-1.5 -right-2 grid min-w-4 place-items-center rounded-full bg-bad-solid px-1 text-[10px] leading-4 font-bold text-white">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
      {badge && !compact ? (
        <span className="ml-auto grid min-w-6 place-items-center rounded-full bg-bad-solid px-1.5 text-xs leading-6 font-bold text-white">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

export function Layout() {
  const { home, status, alerts } = useLive();
  const now = useNow(1_000);
  const session = useSession();
  const { search } = useLocation();
  const parent = home.data;
  const openCount = alerts.data?.alerts.filter(isOpen).length ?? 0;
  const look = status.data ? statusLook(status.data.status) : null;
  const firstName = session?.name?.trim().split(/\s+/)[0];

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-7 border-r border-line px-4 py-6 md:flex">
        <div className="px-2">
          <Wordmark />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {TABS.map((t) => (
            <Tab key={t.to} {...t} badge={t.to === "/alerts" ? openCount : 0} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <ParentCard name={parent?.parent_name} city={parent?.city} phone={parent?.parent_phone} look={look} />
          <FamilyName />
          <AccountRow />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
            <div className="md:hidden">
              <Wordmark />
            </div>
            <div className="hidden min-w-0 md:block">
              <p className="text-sm text-muted">
                {greeting(now)}
                {firstName ? `, ${firstName}` : ""}
              </p>
              <p className="display truncate text-lg font-semibold">
                {parent ? `${parent.parent_name} · ${parent.city}` : " "}
              </p>
            </div>
            {look ? (
              <Link
                to={{ pathname: "/", search }}
                className={cn("press ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold md:ml-4", look.tone)}
              >
                <span className="relative flex size-2.5">
                  {status.data?.status !== "green" ? (
                    <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", look.dot)} />
                  ) : null}
                  <span className={cn("relative inline-flex size-2.5 rounded-full", look.dot)} />
                </span>
                {look.label}
              </Link>
            ) : null}
            {config.useMock ? (
              <div className="order-last w-full md:order-none md:ml-auto md:w-auto">
                <DemoSwitch />
              </div>
            ) : null}
            <div className={cn("text-right", !config.useMock && "md:ml-auto")}>
              <time
                dateTime={now.toISOString()}
                className="display block text-xl font-semibold tabular-nums"
                aria-label={`Time in Chennai ${formatTimeIST(now)}`}
              >
                {formatTimeIST(now)}
              </time>
              <p className="text-xs text-muted">
                <span className="hidden sm:inline">{formatDateIST(now)} · </span>IST{config.useMock ? " · demo data" : ""}
              </p>
            </div>
          </div>
        </header>

        {status.error && status.data ? (
          <p role="status" className="bg-warn-bg px-4 py-2 text-center text-sm font-medium text-warn-ink">
            Can't reach Saathi right now — showing the last update. Retrying…
          </p>
        ) : null}
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-36 outline-none md:px-8 md:pb-12"
        >
          <Outlet />
          <div className="mt-10 border-t border-line pt-5 md:hidden">
            <FamilyName />
            <div className="mt-3">
              <AccountRow />
            </div>
          </div>
        </main>
      </div>

      <MobileAckBar />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 flex gap-0.5 border-t border-line bg-surface/95 px-1.5 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {TABS.map((t) => (
          <Tab key={t.to} {...t} compact badge={t.to === "/alerts" ? openCount : 0} />
        ))}
      </nav>
    </div>
  );
}

/** The parent's photo, name and live status at the foot of the sidebar, with "Call" when known. */
function ParentCard({
  name,
  city,
  phone,
  look,
}: {
  name?: string;
  city?: string;
  phone?: string | null;
  look: ReturnType<typeof statusLook> | null;
}) {
  const photo = FAMILY[0]?.src;
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-card">
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          {photo ? <img src={photo} alt="" className="size-12 rounded-xl object-cover" /> : null}
          {look ? <span className={cn("absolute -right-1 -bottom-1 size-3.5 rounded-full ring-2 ring-surface", look.dot)} /> : null}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{name ?? " "}</p>
          <p className="truncate text-sm text-muted">{look ? look.label : city}</p>
        </div>
      </div>
      {phone ? <CallLink phone={phone} name={name} className="mt-3 w-full" /> : null}
    </div>
  );
}

/** Who is signed in, the theme toggle and "Sign out". */
function AccountRow() {
  const session = useSession();
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3 text-sm text-muted">
      <span className="min-w-0 flex-1 truncate" title={session?.email}>
        {session?.email}
      </span>
      <ThemeToggle />
      <button
        type="button"
        onClick={() => {
          void signOut();
          navigate("/login", { replace: true });
        }}
        className="press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-ink hover:bg-surface-2"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}

function Wordmark() {
  return (
    // Same mark as the landing page nav: three-petal outline + lowercase "saathi", linking back to it.
    <a href={config.landingUrl} className="flex items-center gap-2 text-ink" aria-label="Saathi home page">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
        {[0, 60, 120].map((r) => (
          <ellipse key={r} cx="12" cy="12" rx="4" ry="10" transform={`rotate(${r} 12 12)`} />
        ))}
      </svg>
      <span className="flare text-[26px] leading-none">saathi</span>
    </a>
  );
}
