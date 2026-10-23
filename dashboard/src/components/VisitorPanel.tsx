import { useEffect, useRef } from "react";
import type { TimelineEvent } from "../api/types";
import { formatTimeIST } from "../lib/time";
import { Icon } from "./Icon";

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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !event) return;
    let untrap: (() => void) | undefined;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      // Focus-trap fallback for browsers without showModal(): non-modal dialog, so Tab is
      // wrapped manually between the first and last focusable elements, Escape closes.
      dialog.setAttribute("open", "");
      dialog.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCloseRef.current();
          return;
        }
        if (e.key !== "Tab") return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        const active = document.activeElement;
        if (!dialog.contains(active)) {
          (e.shiftKey ? last : first).focus();
          e.preventDefault();
        } else if (e.shiftKey && active === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && active === last) {
          first.focus();
          e.preventDefault();
        }
      };
      dialog.addEventListener("keydown", onKey);
      untrap = () => dialog.removeEventListener("keydown", onKey);
    }

    return () => {
      untrap?.();
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
      tabIndex={-1}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="visitor-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="visitor-title" className="flex items-center gap-2 text-lg font-semibold">
            <Icon name="camera" className="h-5 w-5" />
            Doorbell at {time}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-surface-2" aria-label="Close">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        {event.snapshot_url ? (
          <img
            src={event.snapshot_url}
            alt={`Doorbell camera snapshot at ${time}`}
            className="mt-4 aspect-[4/3] w-full rounded-2xl bg-surface-2 object-cover"
          />
        ) : null}
        {v?.caution ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-bad-bg px-3 py-2 font-semibold text-bad-ink">
            <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              Caution{v.caution_reason ? `: ${v.caution_reason}` : ""}. Unknown visitor — check before {parentName} opens the door.
            </span>
          </p>
        ) : null}
        {v ? (
          <>
            <p className="mt-4 text-[17px] leading-relaxed">{v.summary}</p>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Visitor details">
              <li className="rounded-full bg-surface-2 px-3 py-1">
                {v.person_count} {v.person_count === 1 ? "person" : "people"}
              </li>
              <li className="rounded-full bg-surface-2 px-3 py-1">
                {v.uniform_or_badge ? "Uniform or badge" : "No uniform or badge"}
              </li>
              <li className="rounded-full bg-surface-2 px-3 py-1">
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
