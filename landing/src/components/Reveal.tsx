import type { ReactNode } from "react";
import { BlurFade } from "./ui/BlurFade";
import { TextAnimate } from "./ui/TextAnimate";

type Props = { children: ReactNode; delay?: number; className?: string; y?: number };

/**
 * Fades, lifts and un-blurs its children the first time they scroll into view
 * (Magic UI "Blur Fade"). `delay` is in ms, as before.
 */
export function Reveal({ children, delay = 0, className = "", y = 24 }: Props) {
  return (
    <BlurFade inView inViewMargin="-80px" direction="up" offset={y} delay={delay / 1000} duration={0.7} className={className}>
      {children}
    </BlurFade>
  );
}

/**
 * Centred section heading block (DESIGN.md "Section Heading Block"); the title words rise out
 * of a blur one by one (Magic UI "Text Animate", blurInUp by word).
 */
export function SectionHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[640px] px-4 text-center">
      <TextAnimate as="h2" by="word" animation="blurInUp" once className="flare text-[34px] sm:text-heading">
        {title}
      </TextAnimate>
      <Reveal delay={150}>
        <p className="mx-auto mt-4 max-w-[560px] text-body text-slate sm:text-[17px] sm:leading-[1.3]">{children}</p>
      </Reveal>
    </div>
  );
}
