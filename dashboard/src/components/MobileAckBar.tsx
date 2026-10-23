import { Check } from "lucide-react";
import { useAck } from "../hooks/useAck";
import { isOpen } from "../lib/alerts";
import { kindLabel } from "../lib/labels";
import { activeAlert, useLive } from "../state/LiveData";

/** Phones only: while an alert is open, "I'm checking" stays pinned above the tab bar on every tab. */
export function MobileAckBar() {
  const { status, alerts, refreshLive } = useLive();
  const open = activeAlert(status.data, alerts.data?.alerts);
  const { ack, sending } = useAck(open, refreshLive);
  if (!open || !isOpen(open)) return null;
  const red = open.state === "ALERT_FAMILY" || open.state === "ALERT_NEIGHBOUR";
  return (
    <div className="fixed inset-x-3 bottom-[4.75rem] z-20 md:hidden">
      <div
        className={`flex items-center gap-3 rounded-2xl p-2 pl-4 shadow-lift ${
          red ? "bg-bad-solid text-white" : "bg-warn-solid text-warn-solid-ink"
        }`}
      >
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{kindLabel(open.kind)}</p>
        <button
          type="button"
          onClick={() => void ack()}
          disabled={sending}
          className="press inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-4 font-semibold text-ink disabled:opacity-60"
        >
          <Check className="size-4" aria-hidden="true" />
          {sending ? "Sending…" : "I'm checking"}
        </button>
      </div>
    </div>
  );
}
