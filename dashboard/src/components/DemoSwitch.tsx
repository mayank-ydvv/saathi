import type { StatusColour } from "../api/types";
import { useMockVariant } from "../hooks/useMockVariant";

const OPTIONS: { value: StatusColour; label: string; on: string }[] = [
  { value: "green", label: "Normal", on: "bg-ok-dot text-white" },
  { value: "yellow", label: "Checking", on: "bg-warn-dot text-white" },
  { value: "red", label: "Alert", on: "bg-bad-dot text-white" },
];

/** Mock mode only: switch the demo status for filming (same as `?mock=green|yellow|red`). */
export function DemoSwitch() {
  const [variant, setVariant] = useMockVariant();
  return (
    <div
      role="group"
      aria-label="Demo status"
      title="Demo mode: switch the status for recording"
      className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 text-xs font-semibold"
    >
      <span className="px-1.5 tracking-wide text-muted uppercase">Demo</span>
      {OPTIONS.map((o) => {
        const active = variant === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => setVariant(o.value)}
            className={`rounded-lg px-2.5 py-1 transition-colors ${active ? o.on : "text-muted hover:bg-surface-2 hover:text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
