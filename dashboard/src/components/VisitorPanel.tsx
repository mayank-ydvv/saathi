import { BadgeCheck, Camera, Package, ShieldAlert, UserRound, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { TimelineEvent } from "../api/types";
import { formatTimeIST } from "../lib/time";
import { VisitorThumb } from "./VisitorThumb";

/** Doorbell snapshot + the vision summary, in a modal <dialog> (focus returns on close). */
export function VisitorPanel({
  event,
  parentName = "your parent",
  onClose,
}: {
  event: TimelineEvent | null;
  parentName?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !event) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };
  }, [event]);

  if (!event) return null;
  const v = event.visitor;
  const time = formatTimeIST(event.ts);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="visitor-title"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-3xl bg-surface p-0 text-ink shadow-lift backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <h2 id="visitor-title" className="flex items-center gap-2 text-xl font-semibold">
          <Camera className="size-5" aria-hidden="true" />
          Doorbell at {time}
        </h2>
        <button type="button" onClick={onClose} className="press rounded-lg p-2 hover:bg-surface-2" aria-label="Close">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="p-5">
        <VisitorThumb event={event} alt={`Doorbell camera snapshot at ${time}`} className="aspect-[4/3] w-full rounded-2xl" />
        {v?.caution ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-bad-bg px-3 py-2.5 font-semibold text-bad-ink">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <span>
              Caution{v.caution_reason ? `: ${v.caution_reason}` : ""}. Unknown visitor — check before {parentName} opens the door.
            </span>
          </p>
        ) : null}
        {v ? (
          <>
            <p className="mt-4 text-[17px] leading-relaxed">{v.summary}</p>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Visitor details">
              <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1">
                <UserRound className="size-4" aria-hidden="true" />
                {v.person_count} {v.person_count === 1 ? "person" : "people"}
              </li>
              <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1">
                <BadgeCheck className="size-4" aria-hidden="true" />
                {v.uniform_or_badge ? "Uniform or badge" : "No uniform or badge"}
              </li>
              <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1">
                <Package className="size-4" aria-hidden="true" />
                {v.carrying_package ? "Carrying a package" : "No package"}
              </li>
            </ul>
          </>
        ) : (
          <p className="mt-4 text-muted">No visitor description for this ring.</p>
        )}
      </div>
    </dialog>
  );
}
