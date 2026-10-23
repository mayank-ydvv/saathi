import { useState } from "react";
import { choose, chosen, OPTIONS, type Slot } from "../photoOptions";
import { img } from "../photos";

const NAMES: Record<Slot, string> = {
  hero: "Hero (full screen)",
  ma: "Ma",
  papa: "Papa",
  rahul: "Rahul (son)",
  priya: "Priya (daughter)",
  aarav: "Aarav (grandson)",
  neighbour: "Mrs Iyer (neighbour)",
  hand: "Hand holding the phone",
  courier: "Doorbell snapshot",
  nightDoor: "Front door at night",
  phoneOnTable: "Phone on a table",
};

/**
 * Dev-only panel for comparing the photo options in place. Picking one stores the choice
 * in localStorage and reloads; "Copy picks" gives the list to paste back to Claude.
 */
export function PhotoPicker() {
  const [open, setOpen] = useState(false);
  const picks = chosen();
  const slots = Object.keys(OPTIONS) as Slot[];
  const summary = slots.map((s) => `${NAMES[s]}: option ${(picks[s] ?? 0) + 1}`).join("\n");

  return (
    <div className="fixed bottom-4 right-4 z-50 font-sans text-[13px]">
      {open && (
        <div className="mb-2 max-h-[75vh] w-[min(420px,calc(100vw-32px))] overflow-y-auto rounded-[6px] border border-pressed-cotton bg-parchment p-4 text-graphite">
          <div className="mb-3 flex items-center justify-between">
            <span className="flare text-[22px]">Photo options</span>
            <button
              type="button"
              className="rounded-[4px] border border-deep-ink px-2 py-0.5"
              onClick={() => void navigator.clipboard?.writeText(summary)}
            >
              Copy picks
            </button>
          </div>
          {slots.map((s) => (
            <div key={s} className="mb-4">
              <div className="mb-1 text-slate">{NAMES[s]}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {OPTIONS[s].map((o, i) => {
                  const on = (picks[s] ?? 0) === i;
                  return (
                    <button
                      key={o.src}
                      type="button"
                      title={o.label}
                      onClick={() => {
                        choose(s, i);
                        window.location.reload();
                      }}
                      className={`relative aspect-square overflow-hidden rounded-[4px] ${on ? "outline outline-2 outline-deep-ink" : "opacity-80 hover:opacity-100"}`}
                    >
                      <img src={img(o, 200)} alt={o.label} className="h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 rounded-[3px] bg-white/90 px-1 text-[11px]">{i + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="float-right rounded-[4px] bg-deep-ink px-4 py-2 text-white"
      >
        {open ? "Close" : "Photos"}
      </button>
    </div>
  );
}
