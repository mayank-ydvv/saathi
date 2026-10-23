import { useId } from "react";
import { cn } from "../../lib/cn";

/**
 * Magic UI "Dot Pattern" (magicui.design/docs/components/dot-pattern), static variant. The
 * original draws one animated <circle> per dot; without the glow option that is a few
 * thousand elements for a full screen, so this uses a single SVG <pattern> that looks the
 * same. Colour comes from `text-*` classes.
 */
export function DotPattern({
  width = 16,
  height = 16,
  cr = 1,
  className,
}: {
  width?: number;
  height?: number;
  cr?: number;
  className?: string;
}) {
  const id = useId();
  return (
    <svg aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full text-line", className)}>
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse">
          <circle cx={cr} cy={cr} r={cr} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
