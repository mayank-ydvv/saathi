/**
 * Static/CSS-driven Magic UI components, restyled to the parchment tokens:
 *   PulsatingButton            magicui.design/docs/components/pulsating-button
 *   Ripple                     magicui.design/docs/components/ripple
 *   AvatarCircles              magicui.design/docs/components/avatar-circles
 *   CircularProgress           magicui.design/docs/components/animated-circular-progress-bar
 * Keyframes live in index.css (pulse-ring, ripple).
 */
import { memo, type ButtonHTMLAttributes, type CSSProperties } from "react";
import { cn } from "../../lib/cn";

/** A button with a soft ring pulsing out of it. Used only for the one urgent action. */
export function PulsatingButton({
  className,
  children,
  pulseColor = "color-mix(in oklab, var(--accent) 35%, transparent)",
  duration = "1.6s",
  distance = "10px",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pulseColor?: string; duration?: string; distance?: string }) {
  return (
    <button
      className={cn("relative flex cursor-pointer items-center justify-center", className)}
      style={{ "--pulse-color": pulseColor, "--duration": duration, "--distance": distance } as CSSProperties}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      <span aria-hidden="true" className="animate-pulse-ring pointer-events-none absolute inset-0 rounded-[inherit]" />
    </button>
  );
}

/** Concentric rings breathing out from the centre of the parent (which must be `relative`). */
export const Ripple = memo(function Ripple({
  mainCircleSize = 120,
  mainCircleOpacity = 0.24,
  numCircles = 5,
  className,
}: {
  mainCircleSize?: number;
  mainCircleOpacity?: number;
  numCircles?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 select-none overflow-hidden", className)}
    >
      {Array.from({ length: numCircles }, (_, i) => (
        <div
          key={i}
          className="animate-ripple absolute rounded-full border border-current bg-current/10"
          style={
            {
              "--i": i,
              width: `${mainCircleSize + i * 70}px`,
              height: `${mainCircleSize + i * 70}px`,
              opacity: mainCircleOpacity - i * 0.04,
              animationDelay: `${i * 0.06}s`,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) scale(1)",
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
});

/** Overlapping round photos with an optional "+N". */
export function AvatarCircles({
  people,
  extra = 0,
  size = 40,
  className,
}: {
  people: { src: string; name: string }[];
  extra?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex -space-x-3", className)}>
      {people.map((p) => (
        <img
          key={p.name}
          src={p.src}
          alt={p.name}
          title={p.name}
          width={size}
          height={size}
          className="rounded-full border-2 border-surface object-cover"
          style={{ width: size, height: size }}
        />
      ))}
      {extra > 0 && (
        <span
          className="grid place-items-center rounded-full border-2 border-surface bg-accent text-xs text-accent-ink"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

/** Gauge from min to max with the value in the middle; the arc length animates on change. */
export function CircularProgress({
  value,
  max = 100,
  label,
  className,
  primary = "var(--accent)",
  secondary = "var(--surface-2)",
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
  primary?: string;
  secondary?: string;
}) {
  const circumference = 2 * Math.PI * 45;
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  const pctPx = circumference / 100;
  const common = {
    cx: 50,
    cy: 50,
    r: 45,
    strokeWidth: 10,
    strokeLinecap: "round" as const,
    fill: "none",
  };
  return (
    <div className={cn("relative size-24", className)} role="img" aria-label={label ?? `${pct}%`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle {...common} stroke={secondary} />
        <circle
          {...common}
          stroke={primary}
          strokeDasharray={`${pct * pctPx} ${circumference}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-lg tabular-nums">{value}</span>
    </div>
  );
}
