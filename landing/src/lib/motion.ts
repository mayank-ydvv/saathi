import { useEffect, useRef, useState, type RefObject } from "react";

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Progress through the window [a, b] of an overall progress p, clamped to 0..1. O(1). */
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Calls `onFrame(progress)` on every animation frame while the page scrolls, where progress
 * is 0 when the section's top meets the viewport top and 1 when its bottom meets the
 * viewport bottom. Writing styles in the callback keeps React out of the 60 fps path.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  onFrame: (p: number) => void,
  /** "pin": 0..1 while a tall section is pinned; "pass": 0 entering at the bottom, 1 leaving at the top. */
  mode: "pin" | "pass" = "pin",
) {
  const cb = useRef(onFrame);
  cb.current = onFrame;
  useEffect(() => {
    let raf = 0;
    let last = -1;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const span = r.height - vh;
        const p =
          mode === "pass"
            ? clamp((vh - r.top) / (vh + r.height))
            : span > 0
              ? clamp(-r.top / span)
              : r.top <= 0
                ? 1
                : 0;
        if (p !== last) {
          last = p;
          cb.current(p);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const onResize = () => {
      last = -1;
    };
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [ref, mode]);
}

/** True once the element has scrolled at least `amount` into view (stays true). */
export function useInView<T extends Element>(amount = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setSeen(true);
      },
      { threshold: amount },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount, seen]);
  return [ref, seen] as const;
}

/** Types `text` one character at a time once `start` is true, then holds and loops. */
export function useTyping(text: string, start: boolean, cps = 18, holdMs = 2600) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (reducedMotion()) {
      setN(text.length);
      return;
    }
    let i = 0;
    let timer = 0;
    const step = () => {
      i += 1;
      setN(Math.min(i, text.length));
      if (i < text.length) timer = window.setTimeout(step, 1000 / cps);
      else
        timer = window.setTimeout(() => {
          i = 0;
          step();
        }, holdMs);
    };
    timer = window.setTimeout(step, 400);
    return () => window.clearTimeout(timer);
  }, [text, start, cps, holdMs]);
  return text.slice(0, n);
}
