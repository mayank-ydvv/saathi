import { useRef, type CSSProperties } from "react";
import { Iphone } from "../components/ui/Iphone";
import { SectionHeading } from "../components/Reveal";
import { easeOut, seg, useScrollProgress } from "../lib/motion";
import { img, ma, nightDoor, papa, type Photo } from "../photos";

type Card = { photo: Photo; kind: string; insight: string; stats: [string, string][] };

// The three checks the anomaly engine really runs (see backend/engine).
const CARDS: Card[] = [
  {
    photo: ma.photo,
    kind: "Late start",
    insight: "No kitchen movement by 08:50. Ma is usually there by 07:50.",
    stats: [
      ["07:50", "usual"],
      ["+60 min", "late"],
    ],
  },
  {
    photo: papa.photo,
    kind: "Long inactivity",
    insight: "No movement anywhere for 4 h 5 min. Last seen in the living room at 13:00.",
    stats: [
      ["13:00", "last seen"],
      ["4 h", "quiet"],
    ],
  },
  {
    photo: nightDoor,
    kind: "Night activity",
    insight: "Front door opened at 02:10, an hour it is almost never used.",
    stats: [
      ["02:10", "door"],
      ["1 in 60", "nights"],
    ],
  },
];

/** "Your parents' around-the-clock guardian": three phones that rise at staggered speeds. */
export function Guardian() {
  const ref = useRef<HTMLDivElement>(null);
  const phones = useRef<(HTMLDivElement | null)[]>([]);

  useScrollProgress(
    ref,
    (p) => {
      phones.current.forEach((el, i) => {
        if (!el) return;
        const t = easeOut(seg(p, 0.05 + i * 0.04, 0.45 + i * 0.04));
        el.style.transform = `translateY(${(1 - t) * 140}px)`;
        el.style.opacity = String(Math.min(1, t * 1.6));
      });
    },
    "pass",
  );

  return (
    <section className="relative overflow-hidden py-[120px] sm:py-[160px]" aria-labelledby="guardian">
      <SectionHeading title="Your parents’ around-the-clock guardian">
        You already have enough on your plate. Saathi watches for the changes that matter: a late
        morning, a long silence, a door at the wrong hour. It tells you before a worry becomes an
        emergency, and says why in one plain sentence.
      </SectionHeading>
      <div ref={ref} className="mx-auto mt-16 flex max-w-[860px] justify-center gap-4 px-4 sm:gap-[7%]">
        {CARDS.map((c, i) => (
          <div
            key={c.kind}
            ref={(el) => {
              phones.current[i] = el;
            }}
            className={`w-[42%] max-w-[230px] will-change-transform sm:w-[27%] ${i === 2 ? "hidden sm:block" : ""}`}
          >
            {/* Magic UI iPhone mockup with a dark frame; the insight sits on the screen. */}
            <Iphone src={img(c.photo, 520)} style={{ "--iphone-frame": "#1c1c1e" } as CSSProperties}>
              <div className="absolute inset-0" style={{ fontSize: "6.4cqw" }}>
                <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/80" />
                <div className="absolute inset-x-0 top-[3.2em] text-center text-[0.5em] uppercase tracking-[0.12em] text-white/80">
                  Saathi
                </div>
                <div className="absolute inset-x-0 bottom-0 px-[0.9em] pb-[1.3em] text-center text-white">
                  <div className="text-[0.48em] uppercase tracking-[0.12em] opacity-75">{c.kind}</div>
                  <p className="flare mt-[0.4em] text-[0.82em] leading-[1.1]">{c.insight}</p>
                  <div className="mt-[0.9em] flex justify-center gap-[1.4em]">
                    {c.stats.map(([v, k]) => (
                      <div key={k}>
                        <div className="text-[0.62em]">{v}</div>
                        <div className="text-[0.42em] uppercase opacity-70">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Iphone>
          </div>
        ))}
      </div>
    </section>
  );
}
