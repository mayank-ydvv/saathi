import { CircleCheck } from "lucide-react";
import type { AlertStep } from "../api/types";
import { cn } from "../lib/cn";
import { stepLabel } from "../lib/labels";
import { LADDER } from "../lib/ladder";
import { formatTimeIST } from "../lib/time";

/**
 * An alert's escalation steps left to right (top to bottom on a phone), each with its icon and
 * time. The step it stopped at is highlighted; a resolved alert ends in a green tick.
 */
export function Stepper({ steps, parentName }: { steps: AlertStep[]; parentName?: string }) {
  return (
    <ol className="mt-5 flex flex-col gap-3 sm:flex-row sm:gap-0" aria-label="Escalation steps">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const done = s.state === "RESOLVED";
        const IconCmp = done ? CircleCheck : (LADDER.find((l) => l.state === s.state)?.icon ?? CircleCheck);
        return (
          <li key={`${s.state}-${s.at}`} className="relative flex flex-1 items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
            {!last ? (
              <span className="absolute top-[18px] left-[18px] hidden h-0.5 w-full bg-line sm:block" aria-hidden="true" />
            ) : null}
            <span
              className={cn(
                "relative grid size-9 shrink-0 place-items-center rounded-full border-2",
                done ? "border-ok-dot bg-ok-dot text-white" : last ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-muted",
              )}
              aria-hidden="true"
            >
              <IconCmp className="size-4" />
            </span>
            <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3 sm:flex-col sm:pr-3">
              <span className={cn("text-[15px]", last ? "font-bold" : "font-medium")}>{stepLabel(s.state, parentName)}</span>
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
