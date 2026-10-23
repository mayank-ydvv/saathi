import { Reveal, SectionHeading } from "../components/Reveal";
import { useInView, useTyping } from "../lib/motion";
import { courier, img, ma } from "../photos";

const NUDGE = "Kamala ji, are you okay? Please tap the green button.";
const VISITOR = "A courier in uniform, holding a parcel. Not flagged.";
const CONNECT = [
  "Ring Video Doorbell",
  "Ring Indoor Cam",
  "Ring motion alerts",
  "Telegram",
  "Amazon Polly voice",
  "Amazon Bedrock",
  "AWS Step Functions",
];

function Waveform() {
  return (
    <div className="flex h-[22px] items-center justify-center gap-[3px]" aria-hidden>
      {Array.from({ length: 34 }, (_, i) => (
        <span
          key={i}
          className="block w-[2px] rounded-full bg-white/80"
          style={{
            height: `${30 + ((i * 37) % 70)}%`,
            animation: `wave ${0.7 + ((i * 13) % 9) / 10}s ease-in-out ${(i % 7) * 0.08}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Caption({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-3 text-center">
      <div className="text-[12px] uppercase tracking-[0.04em] text-graphite">{label}</div>
      <div className="mt-1 text-[12px] text-slate">{text}</div>
    </div>
  );
}

/** "Effortless care, nothing to wear": the voice, vision and connect cards. */
export function Effortless() {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const nudge = useTyping(NUDGE, seen, 20);
  const visitor = useTyping(VISITOR, seen, 24, 3200);

  return (
    <section className="py-[100px] sm:py-[140px]" aria-labelledby="effortless">
      <SectionHeading title="Effortless care, nothing to wear">
        Saathi works with the Ring doorbell and cameras already in the house. Nothing to charge,
        nothing to remember, nothing new for your parents to learn.
      </SectionHeading>
      <div ref={ref} className="mx-auto mt-14 grid max-w-[1000px] gap-5 px-4 sm:grid-cols-3">
        <Reveal>
          <div className="relative flex aspect-[4/5] flex-col items-center overflow-hidden rounded-[6px] bg-[linear-gradient(180deg,#a9c1d1,#7f9db3)] px-6 pt-[22%] text-white">
            <img
              src={img(ma.photo, 240)}
              alt=""
              className="h-[72px] w-[72px] rounded-full border-2 border-white/70 object-cover"
              style={{ objectPosition: ma.photo.focus }}
            />
            <div className="mt-1 text-[12px] opacity-80">{ma.name}</div>
            <div className="mt-auto w-full pb-8">
              <Waveform />
              <p className="caret mt-4 min-h-[3.2em] text-[15px] italic leading-[1.3]">{nudge}</p>
            </div>
          </div>
          <Caption label="Voice" text="A gentle spoken nudge, in English or Hindi." />
        </Reveal>

        <Reveal delay={120}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-[6px] bg-pressed-cotton">
            <img
              src={img(courier, 700)}
              alt="A courier at the front door"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: courier.focus }}
            />
            <div className="absolute" style={{ animation: "scan 5s ease-in-out infinite" }} aria-hidden>
              {["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "left-0 bottom-0 border-l border-b", "right-0 bottom-0 border-r border-b"].map(
                (c) => (
                  <span key={c} className={`absolute h-5 w-5 border-white ${c}`} />
                ),
              )}
            </div>
            <div className="absolute inset-x-4 bottom-4 rounded-[4px] bg-black/45 px-3 py-2 text-[13px] leading-[1.25] text-white backdrop-blur-sm">
              <span className="caret">{visitor}</span>
            </div>
          </div>
          <Caption label="Vision" text="Bedrock describes who is at the door." />
        </Reveal>

        <Reveal delay={240}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-[6px] bg-linen">
            <div className="absolute inset-0 [mask-image:linear-gradient(transparent,black_30%,black_70%,transparent)]">
              <ul className="flex flex-col items-center gap-7 pt-6" style={{ animation: "ticker 16s linear infinite" }}>
                {[...CONNECT, ...CONNECT].map((c, i) => (
                  <li key={i} className="flex items-center gap-3 text-[17px] text-dusk">
                    <span className="h-3 w-3 rounded-[3px] border border-dusk/60" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Caption label="Connect" text="Ring in, Telegram and voice out." />
        </Reveal>
      </div>
    </section>
  );
}
