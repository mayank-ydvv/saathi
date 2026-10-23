import { CloudOff, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ApiError } from "../api/client";
import { cn } from "../lib/cn";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl bg-surface p-5 shadow-card md:p-6", className)}>{children}</section>;
}

/** A card heading: title, an optional line underneath and something on the right. */
export function CardHeader({ title, sub, aside }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold">{title}</h2>
        {sub ? <p className="mt-0.5 text-[15px] text-muted">{sub}</p> : null}
      </div>
      {aside}
    </div>
  );
}

/** Placeholder bars while text loads. */
export function Skeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 rounded-full bg-surface-2" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

/** A placeholder block with the shape of what is loading (a card, a chart, a row of tiles). */
export function Block({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-surface-2", className)} aria-hidden="true" />;
}

export function Loading({ label, lines, children }: { label: string; lines?: number; children?: ReactNode }) {
  return (
    <Card>
      <span className="sr-only" role="status">
        {label}
      </span>
      {children ?? <Skeleton lines={lines} />}
    </Card>
  );
}

const MESSAGES: Record<string, string> = {
  network: "Can't reach Saathi right now. Check your connection.",
  http: "Saathi had a problem answering.",
  not_found: "Nothing here yet.",
};

/** Friendly error with a Retry button. */
export function ErrorCard({ error, onRetry, what }: { error: ApiError; onRetry: () => void; what: string }) {
  return (
    <Card className="flex flex-col items-start gap-3">
      <p className="flex items-center gap-3 font-semibold">
        <span className="grid size-10 place-items-center rounded-xl bg-bad-bg text-bad-ink">
          <CloudOff className="size-5" aria-hidden="true" />
        </span>
        Couldn't load {what}
      </p>
      <p className="text-muted">{MESSAGES[error.kind] ?? error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="press inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 font-medium hover:bg-surface-2"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        Retry
      </button>
    </Card>
  );
}

export function Empty({ title, icon: IconCmp = Inbox, children }: { title: string; icon?: LucideIcon; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
        <IconCmp className="size-7" aria-hidden="true" />
      </span>
      <p className="mt-4 text-lg font-semibold">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-muted">{children}</div> : null}
    </Card>
  );
}

/** Page heading: the title, one line on what the page is for, and an optional action. */
export function PageTitle({ children, sub, aside }: { children: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold md:text-[2.5rem] md:leading-tight">{children}</h1>
        {sub ? <p className="mt-1 max-w-2xl text-[17px] text-muted">{sub}</p> : null}
      </div>
      {aside}
    </div>
  );
}
