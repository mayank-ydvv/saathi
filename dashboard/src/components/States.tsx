import type { ReactNode } from "react";
import type { ApiError } from "../api/client";
import { Icon } from "./Icon";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-surface p-5 shadow-card ${className}`}>{children}</section>;
}

/** Grey placeholder blocks while data loads. */
export function Skeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 rounded-full bg-surface-2" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function Loading({ label, lines }: { label: string; lines?: number }) {
  return (
    <Card>
      <span className="sr-only" role="status">
        {label}
      </span>
      <Skeleton lines={lines} />
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
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="alert" className="h-5 w-5 text-bad-ink" />
        Couldn't load {what}
      </p>
      <p className="text-muted">{MESSAGES[error.kind] ?? error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 font-medium hover:bg-surface-2"
      >
        <Icon name="refresh" className="h-4 w-4" />
        Retry
      </button>
    </Card>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children ? <div className="mt-1 text-muted">{children}</div> : null}
    </Card>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {sub ? <p className="mt-0.5 text-muted">{sub}</p> : null}
    </div>
  );
}
