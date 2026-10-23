import { family, img } from "../photos";

/** Phone screen 1: everyone Saathi keeps an eye on, as a 3 × 2 grid (the avatars land here). */
export function FamilyGridScreen() {
  return (
    <div className="absolute inset-0 flex flex-col bg-parchment pt-[2.6em]">
      <div className="px-[1em] text-center">
        <div className="flare text-[1.05em] text-graphite">Saathi</div>
        <div className="mt-[0.35em] text-[0.55em] text-slate">Watching today’s routine</div>
      </div>
      <div className="mt-[0.8em] grid flex-1 grid-cols-3 grid-rows-2 gap-[0.18em] px-[0.18em] pb-[0.18em]">
        {family.map((m) => (
          <div key={m.key} className="relative overflow-hidden rounded-[0.3em]">
            <img
              src={img(m.photo, 240)}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: m.photo.focus }}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-[0.4em] pb-[0.3em] pt-[1em] text-[0.5em] text-white">
              {m.name}
              <div className="opacity-75">{m.role}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const DAY = [
  { at: "06:50", zone: "Bedroom", note: "Up and about" },
  { at: "07:40", zone: "Kitchen", note: "Tea, as usual" },
  { at: "11:05", zone: "Front door", note: "Courier, parcel" },
  { at: "13:00", zone: "Living room", note: "Lunch" },
  { at: "17:30", zone: "Front door", note: "Evening walk" },
  { at: "20:10", zone: "Kitchen", note: "Dinner" },
];

/** Phone screen 2: the evening digest written by Bedrock, plus a sliding strip of the day. */
export function DigestScreen() {
  const tiles = [...DAY, ...DAY];
  return (
    <div className="absolute inset-0 flex flex-col bg-parchment">
      <div
        className="relative flex flex-[1.35] flex-col px-[1em] pt-[2.8em] text-white"
        style={{ background: "linear-gradient(180deg,#c9774f 0%,#a24a52 55%,#4b2a48 100%)" }}
      >
        <div className="text-center text-[0.5em] uppercase tracking-[0.12em] opacity-80">Today</div>
        <div className="flare mt-[0.6em] text-center text-[1.05em]">Evening digest</div>
        <p className="mt-[0.5em] text-center text-[0.55em] leading-[1.3] opacity-90">
          Ma had a calm, ordinary day. Up at 06:50, kitchen by 07:40, and a courier dropped a parcel
          at 11:05. No alerts today.
        </p>
        <div className="mt-auto grid grid-cols-3 gap-[0.4em] pb-[0.9em] text-center">
          {[
            ["06:50", "up"],
            ["4", "rooms"],
            ["0", "alerts"],
          ].map(([v, k]) => (
            <div key={k}>
              <div className="mx-auto mb-[0.3em] h-[1.6em] w-[1.6em] rounded-full border border-white/50" />
              <div className="text-[0.7em]">{v}</div>
              <div className="text-[0.45em] uppercase opacity-75">{k}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden pt-[0.6em]">
        <div className="px-[1em] text-[0.55em] text-graphite">Ma’s day</div>
        <div
          className="mt-[0.5em] flex w-max gap-[0.35em] pl-[0.5em]"
          style={{ animation: "strip 18s linear infinite" }}
        >
          {tiles.map((t, i) => (
            <div key={i} className="w-[4.2em] shrink-0 rounded-[0.35em] bg-linen p-[0.45em]">
              <div className="text-[0.62em] text-graphite">{t.at}</div>
              <div className="mt-[0.2em] text-[0.48em] text-slate">{t.zone}</div>
              <div className="mt-[0.9em] text-[0.45em] leading-[1.2] text-slate">{t.note}</div>
            </div>
          ))}
        </div>
        <div className="mt-[0.8em] flex justify-around px-[0.8em] text-[0.42em] text-slate">
          <span>Today</span>
          <span>Alerts</span>
          <span className="text-graphite">Digest</span>
          <span>Routine</span>
        </div>
      </div>
    </div>
  );
}
