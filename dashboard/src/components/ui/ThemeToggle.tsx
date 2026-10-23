/**
 * Magic UI "Animated Theme Toggler" (magicui.design/docs/components/animated-theme-toggler),
 * circle variant: the new theme spreads out from the button using the View Transitions API
 * (instant switch where it isn't supported). Controlled by lib/theme. Unlike the original's
 * icon-only button, it has a visible text label (the design system has no icon-only buttons).
 */
import { Moon, Sun } from "lucide-react";
import { useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { cn } from "../../lib/cn";
import { setTheme, useTheme } from "../../lib/theme";

export function ThemeToggle({ className, duration = 450 }: { className?: string; duration?: number }) {
  const theme = useTheme();
  const isDark = theme === "dark";
  const ref = useRef<HTMLButtonElement>(null);

  const toggle = useCallback(() => {
    const next = isDark ? "light" : "dark";
    const button = ref.current;
    if (!button || typeof document.startViewTransition !== "function") {
      setTheme(next);
      return;
    }
    const { top, left, width, height } = button.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));
    // Percentages of the snapshot box (see the original's note on fractional display scales).
    const at = `${(x / vw) * 100}% ${(y / vh) * 100}%`;
    const radius = `${(r / (Math.hypot(vw, vh) / Math.SQRT2)) * 100}%`;
    const transition = document.startViewTransition(() => flushSync(() => setTheme(next)));
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0% at ${at})`, `circle(${radius} at ${at})`] },
          { duration, easing: "ease-in-out", fill: "forwards", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
  }, [isDark, duration]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      className={cn("inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-ink", className)}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      {isDark ? "Light" : "Dark"}
    </button>
  );
}
