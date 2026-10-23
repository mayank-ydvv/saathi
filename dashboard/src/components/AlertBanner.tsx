import { useState } from "react";
import { ackAlert } from "../api/client";
import type { Alert, AlertState } from "../api/types";
import { CircularProgress, PulsatingButton } from "./ui/effects";
import { useFamilyName } from "../hooks/useFamilyName";
import { kindLabel, stepLabel } from "../lib/labels";
import { formatTimeIST } from "../lib/time";
import { FamilyName } from "./FamilyName";
import { Icon } from "./Icon";

/** The escalation ladder before it resolves (contract: SUSPECT → … → ALERT_NEIGHBOUR). */
const LADDER: AlertState[] = ["SUSPECT", "NUDGE_PARENT", "ALERT_FAMILY", "ALERT_NEIGHBOUR"];

/** Open alert: its current step, and "I'm checking" (POST /alerts/{id}/ack as family). */
export function AlertBanner({
  alert,
  parentName,
  onAcked,
}: {
  alert: Alert;
  parentName?: string;
  onAcked: () => void;
}) {
  const [name] = useFamilyName();
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const step = alert.steps.at(-1);
  const red = alert.state === "ALERT_FAMILY" || alert.state === "ALERT_NEIGHBOUR";
  const rung = Math.max(1, LADDER.indexOf(alert.state) + 1);

  async function ack() {
    setSending(true);
    setFailed(false);
    const result = await ackAlert(alert.alert_id, { by: "family", name });
    setSending(false);
    if (result.ok) onAcked();
    else setFailed(true);
  }

  return (
    <section
      aria-label="Open alert"
      className={`rounded-2xl border-2 p-5 shadow-card ${red ? "border-bad-dot bg-surface" : "border-warn-dot bg-surface"}`}
    >
      <p className="text-sm font-semibold text-muted">
        {kindLabel(alert.kind)} · since {formatTimeIST(alert.created_at)}
      </p>
      <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
        <Icon name={red ? "alert" : "clock"} className={`h-5 w-5 ${red ? "text-bad-ink" : "text-warn-ink"}`} />
        {stepLabel(alert.state, parentName)}
        {step ? <span className="font-normal text-muted">at {formatTimeIST(step.at)}</span> : null}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Once the family has been alerted, the one action pulses (Magic UI pulsating button). */}
        <PulsatingButton
          type="button"
          onClick={() => void ack()}
          disabled={sending}
          pulse={red && !sending}
          className="min-h-12 rounded-xl bg-accent px-6 text-lg font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60"
        >
          <Icon name="check" className="h-5 w-5" />
          {sending ? "Sending…" : "I'm checking"}
        </PulsatingButton>
        <div className="flex items-center gap-3">
          <CircularProgress
            value={rung}
            max={LADDER.length}
            label={`Step ${rung} of ${LADDER.length}`}
            className="size-14 text-sm"
            primary={red ? "var(--bad-dot)" : "var(--warn-dot)"}
          />
          <p className="text-sm text-muted">
            Step {rung} of {LADDER.length}
            <br />
            {rung < LADDER.length ? `next: ${stepLabel(LADDER[rung] ?? "ALERT_NEIGHBOUR", parentName)}` : "last step"}
          </p>
        </div>
        <div className="sm:ml-auto sm:min-w-64">
          <FamilyName />
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
