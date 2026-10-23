import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Pixels of pull that count as a refresh; finger travel maps 1:0.5 for a weighted feel. */
const THRESHOLD_PX = 64;
const MAX_INDICATOR_PX = 96;
const DRAG_RATIO = 0.5;

/**
 * Pull the page down from the top on a touch device to call `onRefresh`. Purely visual on
 * desktop (no touch events fire there). The indicator is the refresh icon, rising and
 * spinning with the pull distance, and snaps back on release.
 */
export function PullToRefresh({ children, onRefresh }: { children: ReactNode; onRefresh: () => void }) {
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pullRef = useRef(0);
  const armedRef = useRef(false);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const track = (px: number) => {
      pullRef.current = px;
      setPull(px);
    };
    const onStart = (e: TouchEvent) => {
      const start = e.touches[0];
      if (e.touches.length !== 1 || !start) return;
      draggingRef.current = true;
      setDragging(true);
      armedRef.current = window.scrollY <= 0;
      startYRef.current = start.clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!draggingRef.current || !armedRef.current) return;
      const move = e.touches[0];
      if (!move) return;
      const dy = move.clientY - startYRef.current;
      if (dy <= 0 || window.scrollY > 0) {
        track(0);
        return;
      }
      track(Math.min(Math.round(dy * DRAG_RATIO), MAX_INDICATOR_PX));
    };
    const onEnd = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      if (pullRef.current >= THRESHOLD_PX) onRefreshRef.current();
      track(0);
    };
    const onCancel = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      track(0);
    };

    document.addEventListener("touchstart", onStart);
    document.addEventListener("touchmove", onMove);
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onCancel);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none relative z-10 grid justify-center overflow-hidden"
        style={{
          height: pull,
          transition: dragging ? "none" : "height 250ms ease-out, transform 400ms ease-out",
        }}
      >
        <span
          className={pull > 0 ? "grid place-items-center" : "absolute opacity-0"}
          style={{ transform: `rotate(${pull * 3}deg)` }}
        >
          <Icon name="refresh" className="h-6 w-6 text-accent" />
        </span>
      </div>
      {children}
    </>
  );
}
