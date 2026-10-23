import { useRef, type ReactNode, type RefObject } from "react";
import { SectionHeading } from "../components/Reveal";
import { AnimatedBeam } from "../components/ui/AnimatedBeam";
import { DotPattern } from "../components/ui/DotPattern";
import { img, ma, neighbour, priya } from "../photos";

function Node({ nodeRef, label, children, big = false }: { nodeRef: RefObject<HTMLDivElement>; label: string; children: ReactNode; big?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={nodeRef}
        className={`z-10 grid place-items-center overflow-hidden rounded-full border border-pressed-cotton bg-parchment text-graphite ${big ? "size-20 sm:size-24" : "size-14 sm:size-16"}`}
      >
        {children}
      </div>
      <span className="max-w-[110px] text-center text-[12px] leading-tight text-slate sm:text-caption">{label}</span>
    </div>
  );
}

/** Outline glyphs (16–20 px, monochrome, per DESIGN.md imagery notes). */
const Glyph = {
  bell: (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="3" />
      <circle cx="12" cy="9" r="2.5" />
      <circle cx="12" cy="16.5" r="1.4" />
    </svg>
  ),
  cam: (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="12" cy="10" r="6.5" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8 19h8M12 16.5V19" />
    </svg>
  ),
  motion: (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  ),
  mark: (
    <svg viewBox="0 0 24 24" className="size-9 sm:size-11" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      {[0, 60, 120].map((r) => (
        <ellipse key={r} cx="12" cy="12" rx="4" ry="10" transform={`rotate(${r} 12 12)`} />
      ))}
    </svg>
  ),
};

/**
 * "How it works": Ring signals flow into Saathi, and Saathi reaches out to Ma, the family and
 * the neighbour (Magic UI "Animated Beam" on a dot-pattern ground). The beams run left to
 * right, the same order as the real pipeline: webhooks → engine → escalation ladder.
 */
export function HowItWorks() {
  const box = useRef<HTMLDivElement>(null);
  const bell = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const motion = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const mom = useRef<HTMLDivElement>(null);
  const fam = useRef<HTMLDivElement>(null);
  const nbr = useRef<HTMLDivElement>(null);
  const beam = { containerRef: box, pathColor: "var(--color-slate)", pathOpacity: 0.25, gradientStartColor: "#192830", gradientStopColor: "#535557", duration: 4 };

  return (
    <section className="relative overflow-hidden py-[100px] sm:py-[140px]" aria-label="How Saathi works">
      <SectionHeading title="How it works">
        The Ring devices already at home send small signals: a door, a room, a moment. Saathi
        learns what a normal day looks like and, when one isn't, asks Ma first, then the family,
        then a neighbour.
      </SectionHeading>
      <div ref={box} className="relative mx-auto mt-14 flex max-w-[860px] items-center justify-between px-4 py-10 sm:px-10">
        <DotPattern className="text-pressed-cotton [mask-image:radial-gradient(360px_circle_at_center,white,transparent)]" />
        <div className="flex flex-col gap-8 sm:gap-10">
          <Node nodeRef={bell} label="Ring doorbell">{Glyph.bell}</Node>
          <Node nodeRef={cam} label="Indoor cameras">{Glyph.cam}</Node>
          <Node nodeRef={motion} label="Motion events">{Glyph.motion}</Node>
        </div>
        <Node nodeRef={hub} label="Saathi learns the day" big>
          {Glyph.mark}
        </Node>
        <div className="flex flex-col gap-8 sm:gap-10">
          <Node nodeRef={mom} label="Ma: “Are you okay?”">
            <img src={img(ma.photo, 160)} alt="" className="size-full object-cover" style={{ objectPosition: ma.photo.focus }} />
          </Node>
          <Node nodeRef={fam} label="Family on Telegram">
            <img src={img(priya.photo, 160)} alt="" className="size-full object-cover" style={{ objectPosition: priya.photo.focus }} />
          </Node>
          <Node nodeRef={nbr} label="Neighbour">
            <img src={img(neighbour.photo, 160)} alt="" className="size-full object-cover" style={{ objectPosition: neighbour.photo.focus }} />
          </Node>
        </div>
        <AnimatedBeam {...beam} fromRef={bell} toRef={hub} curvature={-60} />
        <AnimatedBeam {...beam} fromRef={cam} toRef={hub} delay={0.4} />
        <AnimatedBeam {...beam} fromRef={motion} toRef={hub} curvature={60} delay={0.8} />
        <AnimatedBeam {...beam} fromRef={hub} toRef={mom} curvature={-60} delay={1.2} />
        <AnimatedBeam {...beam} fromRef={hub} toRef={fam} delay={1.6} />
        <AnimatedBeam {...beam} fromRef={hub} toRef={nbr} curvature={60} delay={2} />
      </div>
    </section>
  );
}
