import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";

/** Per-item props for a roving tabindex group (moved by arrows, Home and End jumps). */
export interface RovingHandles {
  ref: (el: HTMLElement | null) => void;
  tabIndex: 0 | -1;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

/**
 * One roving item per element inside a lane-like group. Tab reaches the group once (only the
 * active item has tabIndex 0); ArrowLeft/ArrowRight move within it, Home/End jump to the
 * ends. Focus from Tab itself also makes that item active.
 */
export function useRovingTabIndex(count: number): RovingHandles[] {
  const items = useRef<(HTMLElement | null)[]>([]).current;
  const [active, setActive] = useState(0);

  const move = useCallback(
    (index: number) => {
      const next = ((index % count) + count) % count;
      items[next]?.focus();
      setActive(next);
    },
    [count, items],
  );

  return useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        ref: (el: HTMLElement | null) => {
          items[index] = el;
        },
        tabIndex: index === active ? 0 : -1,
        onFocus: () => setActive(index),
        onKeyDown: (e: KeyboardEvent) => {
          const target =
            e.key === "ArrowLeft"
              ? index - 1
              : e.key === "ArrowRight"
                ? index + 1
                : e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? count - 1
                    : null;
          if (target === null) return;
          e.preventDefault();
          move(target);
        },
      })),
    [count, active, items, move],
  );
}
