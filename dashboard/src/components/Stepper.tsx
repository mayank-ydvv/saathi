import type { AlertStep } from "../api/types";
import { stepLabel } from "../lib/labels";
import { formatTimeIST } from "../lib/time";

/** Vertical list of an alert's escalation steps with their times. */
export function Stepper({ steps, parentName }: { steps: AlertStep[]; parentName?: string }) {
  return (
    <ol className="mt-4 space-y-0" aria-label="Escalation steps">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const done = s.state === "RESOLVED";
        return (
          <li key={`${s.state}-${s.at}`} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? <span className="absolute top-5 left-[7px] h-full w-0.5 bg-line" aria-hidden="true" /> : null}
            <span
              className={`relative mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
                done ? "border-ok-dot bg-ok-dot" : last ? "border-accent bg-surface" : "border-muted bg-muted"
              }`}
              aria-hidden="true"
            />
            <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3">
              <span className={last ? "font-semibold" : ""}>{stepLabel(s.state, parentName)}</span>
              <time dateTime={s.at} className="text-sm text-muted tabular-nums">
                {formatTimeIST(s.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
