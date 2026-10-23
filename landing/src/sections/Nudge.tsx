import { useEffect, useState } from "react";
import { Phone } from "../components/Phone";
import { SectionHeading } from "../components/Reveal";
import { useInView, useTyping } from "../lib/motion";
import { img, ma } from "../photos";

const LINE = "Kamala ji, are you okay?";

/** "One tap to say I'm okay": the parent app inside a tall dark phone, typed out live. */
export function Nudge() {
  const [ref, seen] = useInView<HTMLDivElement>(0.4);
  const typed = useTyping(LINE, seen, 14, 3400);
  const done = typed.length === LINE.length;
  const [tapped, setTapped] = useState(false);

  useEffect(() => {
    if (!done) {
      setTapped(false);
      return;
    }
    const t = window.setTimeout(() => setTapped(true), 1500);
    return () => window.clearTimeout(t);
  }, [done]);

  return (
    <section className="overflow-hidden pt-[100px] sm:pt-[140px]" aria-labelledby="nudge">
      <SectionHeading title="One tap to say “I’m okay”">
        Before anyone is worried, Saathi asks your parent first. A calm voice and one huge green
        button on a tablet by the bed. One tap ends the alert, and the family never needs to know.
      </SectionHeading>
      <div ref={ref} className="mx-auto mt-14 h-[420px] w-[78%] max-w-[300px] overflow-hidden sm:h-[520px]">
        <Phone dark className="w-full">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#22262c_0%,#2c3a46_55%,#3b5566_100%)] text-white">
            <div className="flex items-center justify-between px-[1.2em] pt-[2.7em] text-[0.5em] uppercase tracking-[0.12em] text-white/70">
              <span>⌄</span>
              <span>Saathi</span>
              <span>···</span>
            </div>
            <p className="flare px-[1em] pt-[2.4em] text-[1.1em] italic leading-[1.15]">
              <span className={done ? "" : "caret"}>{typed}</span>
            </p>
            <div
              className="mx-[1em] mt-[1.6em] rounded-[0.35em] py-[0.9em] text-center text-[0.95em] transition-all duration-700"
              style={{
                background: tapped ? "#14532d" : "#1f7a44",
                opacity: done ? 1 : 0,
                transform: done ? "none" : "translateY(0.6em)",
              }}
            >
              {tapped ? "Thank you, Ma ✓" : "I’m okay"}
            </div>
            <div className="absolute inset-x-0 top-[62%] flex flex-col items-center">
              <img
                src={img(ma.photo, 160)}
                alt=""
                className="h-[2.2em] w-[2.2em] rounded-full border border-white/60 object-cover"
                style={{ objectPosition: ma.photo.focus }}
              />
              <div className="mt-[0.3em] text-[0.5em] text-white/80">{ma.name}</div>
            </div>
          </div>
        </Phone>
      </div>
    </section>
  );
}
