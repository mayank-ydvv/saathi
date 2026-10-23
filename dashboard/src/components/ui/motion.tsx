/**
 * Small Magic UI / Aceternity animation components, ported from their registries and restyled
 * to the parchment tokens (colours come from the surrounding text, never black/white literals):
 *   NumberTicker  magicui.design/docs/components/number-ticker
 *   BlurFade      magicui.design/docs/components/blur-fade
 *   AnimatedList  magicui.design/docs/components/animated-list
 *   TextGenerate  ui.aceternity.com/components/text-generate-effect
 */
import {
  AnimatePresence,
  motion,
  stagger,
  useAnimate,
  useInView,
  useMotionValue,
  useSpring,
  type MotionProps,
} from "motion/react";
import { Children, memo, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export function NumberTicker({
  value,
  startValue = 0,
  delay = 0,
  decimalPlaces = 0,
  className,
}: {
  value: number;
  startValue?: number;
  delay?: number;
  decimalPlaces?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(startValue);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (!isInView) return;
    const timer = setTimeout(() => motionValue.set(value), delay * 1000);
    return () => clearTimeout(timer);
  }, [motionValue, isInView, delay, value]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("en-IN", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)));
        }
      }),
    [springValue, decimalPlaces],
  );

  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)}>
      {startValue}
    </span>
  );
}

export function BlurFade({
  children,
  className,
  duration = 0.4,
  delay = 0,
  offset = 6,
  inView = false,
  blur = "6px",
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
  delay?: number;
  offset?: number;
  inView?: boolean;
  blur?: string;
}) {
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, margin: "-50px" });
  const visible = !inView || seen;
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={visible ? "visible" : "hidden"}
      variants={{
        hidden: { y: -offset, opacity: 0, filter: `blur(${blur})` },
        visible: { y: 0, opacity: 1, filter: "blur(0px)" },
      }}
      transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AnimatedListItem({ children }: { children: ReactNode }) {
  const animations: MotionProps = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1, originY: 0 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: "spring", stiffness: 350, damping: 40 },
  };
  return (
    <motion.div {...animations} layout className="mx-auto w-full">
      {children}
    </motion.div>
  );
}

/** Reveals its children one by one, newest on top, `delay` ms apart. */
export const AnimatedList = memo(function AnimatedList({
  children,
  className,
  delay = 1000,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const [index, setIndex] = useState(0);
  const items = useMemo(() => Children.toArray(children), [children]);

  useEffect(() => {
    if (index >= items.length - 1) return;
    const timeout = setTimeout(() => setIndex((i) => (i + 1) % items.length), delay);
    return () => clearTimeout(timeout);
  }, [index, delay, items.length]);

  const shown = useMemo(() => items.slice(0, index + 1).reverse(), [index, items]);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <AnimatePresence>
        {shown.map((item) => (
          <AnimatedListItem key={(item as ReactElement).key}>{item}</AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  );
});

/** Words appear one after another out of a blur, like the digest being written. */
export function TextGenerate({
  words,
  className,
  duration = 0.5,
  "aria-hidden": ariaHidden,
}: {
  words: string;
  className?: string;
  duration?: number;
  "aria-hidden"?: boolean;
}) {
  const [scope, animate] = useAnimate();
  const list = words.split(" ");
  useEffect(() => {
    void animate("span", { opacity: 1, filter: "blur(0px)" }, { duration, delay: stagger(0.035) });
  }, [animate, duration, words]);
  return (
    <div ref={scope} className={className} aria-hidden={ariaHidden}>
      {list.map((word, i) => (
        <motion.span key={word + i} className="opacity-0" style={{ filter: "blur(10px)" }}>
          {word}{" "}
        </motion.span>
      ))}
    </div>
  );
}
