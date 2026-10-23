import { Reveal, SectionHeading } from "../components/Reveal";
import { useInView, useTyping } from "../lib/motion";
import { img, neighbour, phoneOnTable, priya, rahul } from "../photos";

const REPLY = "Calling Ma now, I'll update everyone.";

/** "Involve family & neighbours": the Telegram alert card and the lock-screen photo. */
export function Family() {
  const [ref, seen] = useInView<HTMLDivElement>(0.35);
  const typed = useTyping(REPLY, seen, 16, 3000);
  const people = [rahul, priya];

  return (
    <section className="py-[100px] sm:py-[140px]" aria-labelledby="family">
      <SectionHeading title="Involve family & neighbours">
        You don’t have to do it all from far away. If Ma doesn’t answer, Saathi tells the family on
        Telegram with the reason and when she was last seen, then a trusted neighbour who can knock.
      </SectionHeading>
      <div ref={ref} className="mx-auto mt-14 grid max-w-[1000px] gap-5 px-4 sm:grid-cols-2">
        <Reveal>
          <div
            className="relative aspect-[4/3] overflow-hidden rounded-[6px] p-5 text-white"
            style={{ background: "linear-gradient(160deg,#c46a55 0%,#8c3a55 50%,#3a2042 100%)" }}
          >
            <div className="flex">
              {people.map((m, i) => (
                <div key={m.key} className={`text-center ${i ? "-ml-3" : ""}`}>
                  <img
                    src={img(m.photo, 160)}
                    alt=""
                    className="h-12 w-12 rounded-full border-2 border-white/70 object-cover"
                    style={{ objectPosition: m.photo.focus }}
                  />
                  <div className="mt-1 text-[11px] opacity-80">{m.name}</div>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-5 max-w-[340px] rounded-[6px] bg-white/12 p-3 text-[13px] leading-[1.3] backdrop-blur-sm">
              <div className="text-[11px] uppercase tracking-[0.08em] opacity-70">Saathi · Telegram</div>
              <p className="mt-1">
                Ma hasn’t moved since 13:00 (4 h 5 min). She didn’t answer the nudge. Last seen:
                living room.
              </p>
            </div>
            <div className="mx-auto mt-3 max-w-[340px] rounded-[6px] border border-white/40 bg-white/10 px-3 py-2 text-[13px] italic">
              <span className="caret">{typed}</span>
            </div>
          </div>
          <p className="mt-3 text-center text-[12px] text-slate">Alert the family first</p>
        </Reveal>
        <Reveal delay={140}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[6px] bg-pressed-cotton">
            <img
              src={img(phoneOnTable, 1000)}
              alt="A phone lying on a table in warm light"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: phoneOnTable.focus }}
            />
            <div className="absolute left-5 top-5 text-center text-white">
              <img
                src={img(neighbour.photo, 160)}
                alt=""
                className="h-12 w-12 rounded-full border-2 border-white/70 object-cover"
                style={{ objectPosition: neighbour.photo.focus }}
              />
              <div className="mt-1 text-[11px] opacity-90">Neighbour</div>
            </div>
          </div>
          <p className="mt-3 text-center text-[12px] text-slate">…then someone who can knock.</p>
        </Reveal>
      </div>
    </section>
  );
}
