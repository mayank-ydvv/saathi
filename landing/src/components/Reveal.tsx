import type { ReactNode } from "react";
import { useInView } from "../lib/motion";

type Props = { children: ReactNode; delay?: number; className?: string; y?: number };

/** Fades and lifts its children in the first time they scroll into view. */
export function Reveal({ children, delay = 0, className = "", y = 28 }: Props) {
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: seen ? 1 : 0,
        transform: seen ? "none" : `translateY(${y}px)`,
        transition: `opacity 900ms ease ${delay}ms, transform 1100ms cubic-bezier(.2,.7,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** Centred section heading block (DESIGN.md "Section Heading Block"). */
export function SectionHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Reveal className="mx-auto max-w-[640px] px-4 text-center">
      <h2 className="flare text-[34px] sm:text-heading">{title}</h2>
      <p className="mx-auto mt-4 max-w-[560px] text-body text-slate sm:text-[17px] sm:leading-[1.3]">
        {children}
      </p>
    </Reveal>
  );
}
