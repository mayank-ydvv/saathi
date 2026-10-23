import { motion, type MotionStyle } from "motion/react";
import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";

/**
 * Magic UI "Border Beam" (magicui.design/docs/components/border-beam): a short light that
 * travels round the parent's border. Colours default to deep ink → slate instead of the
 * original orange/purple, to stay inside the parchment palette.
 */
export function BorderBeam({
  className,
  size = 80,
  duration = 8,
  delay = 0,
  colorFrom = "var(--accent)",
  colorTo = "var(--muted)",
  borderWidth = 1,
}: {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--border-beam-width) border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)] mask-intersect [mask-clip:padding-box,border-box]"
      style={{ "--border-beam-width": `${borderWidth}px` } as CSSProperties}
    >
      <motion.div
        className={cn("absolute aspect-square bg-linear-to-l from-(--color-from) via-(--color-to) to-transparent", className)}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--color-from": colorFrom,
            "--color-to": colorTo,
          } as MotionStyle
        }
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: ["0%", "100%"] }}
        transition={{ repeat: Infinity, ease: "linear", duration, delay: -delay }}
      />
    </div>
  );
}
