import { Children, type CSSProperties, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Magic UI "Orbiting Circles" (magicui.design/docs/components/orbiting-circles): children are
 * spaced evenly on a circle and orbit the centre. Uses the `animate-orbit` keyframes in
 * index.css. The faint path ring uses the theme's line colour.
 */
export function OrbitingCircles({
  className,
  children,
  reverse,
  duration = 20,
  radius = 160,
  path = true,
  iconSize = 30,
}: {
  className?: string;
  children?: ReactNode;
  reverse?: boolean;
  duration?: number;
  radius?: number;
  path?: boolean;
  iconSize?: number;
}) {
  const count = Children.count(children);
  return (
    <>
      {path && (
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
          <circle className="stroke-line" strokeWidth={1} cx="50%" cy="50%" r={radius} fill="none" />
        </svg>
      )}
      {Children.map(children, (child, index) => (
        <div
          style={
            {
              "--duration": duration,
              "--radius": radius,
              "--angle": (360 / count) * index,
              "--icon-size": `${iconSize}px`,
            } as CSSProperties
          }
          className={cn(
            "animate-orbit absolute flex size-(--icon-size) transform-gpu items-center justify-center rounded-full",
            reverse && "[animation-direction:reverse]",
            className,
          )}
        >
          {child}
        </div>
      ))}
    </>
  );
}
