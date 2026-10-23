import { Check } from "lucide-react";
import type { Alert } from "../api/types";
import { useAck } from "../hooks/useAck";
import { cn } from "../lib/cn";
import { kindLabel, stepLabel } from "../lib/labels";
import { LADDER } from "../lib/ladder";
import { formatTimeIST } from "../lib/time";
import { FamilyName } from "./FamilyName";
import { PulsatingButton } from "./ui/effects";

/**
 * The open alert, inside the status card: where it is on the ladder and "I'm checking"
 * (POST /alerts/{id}/ack as family). A light panel so it reads on any status colour.
 */
export function AlertBanner({
  alert,
  parentName,
  onAcked,
}: {
  alert: Alert;
  parentName?: string;
  onAcked: () => void;
}) {
  const { ack, sending, failed } = useAck(alert, onAcked);
  const step = alert.steps.at(-1);
  const red = alert.state === "ALERT_FAMILY" || alert.state === "ALERT_NEIGHBOUR";
  const rung = Math.max(0, LADDER.findIndex((l) => l.state === alert.state));

  return (
    <section aria-label="Open alert" className="rounded-2xl bg-surface p-4 text-ink shadow-card md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted">
            {kindLabel(alert.kind)} · since {formatTimeIST(alert.created_at)}
          </p>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xl font-bold">
            {stepLabel(alert.state, parentName)}
            {step ? <span className="text-base font-normal text-muted">at {formatTimeIST(step.at)}</span> : null}
          </p>
          <ol className="mt-3 flex items-center gap-1.5" aria-label={`Progress: step ${rung + 1} of ${LADDER.length}`}>
            {LADDER.map((l, i) => (
              <li
                key={l.state}
                aria-current={i === rung ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                  i < rung && "bg-surface-2 text-muted",
                  i === rung && (red ? "bg-bad-bg text-bad-ink" : "bg-warn-bg text-warn-ink"),
                  i > rung && "text-muted/70",
                )}
              >
                <l.icon className="size-3.5" aria-hidden="true" />
                <span className={i === rung ? "" : "hidden sm:inline"}>{l.short}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
          {/* Once the family has been alerted, the one action pulses (Magic UI pulsating button). */}
          <PulsatingButton
            type="button"
            onClick={() => void ack()}
            disabled={sending}
            pulse={red && !sending}
            className="press min-h-12 rounded-xl bg-accent px-6 text-lg font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60"
          >
            <Check className="size-5" aria-hidden="true" />
            {sending ? "Sending…" : "I'm checking"}
          </PulsatingButton>
          <div className="sm:min-w-56">
            <FamilyName />
          </div>
        </div>
      </div>
      {failed ? (
        <p role="alert" className="mt-3 font-medium text-bad-ink">
          Couldn't send that. Please try again.
        </p>
      ) : null}
    </section>
  );
}
