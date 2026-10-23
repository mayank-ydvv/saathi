import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PullToRefresh } from "./PullToRefresh";
import { Toast } from "./Toast";

type TouchType = "touchstart" | "touchmove" | "touchend" | "touchcancel";

/** Fire a touch event at the document with the given finger position (jsdom lacks TouchEvent). */
function fireTouch(type: TouchType, clientY?: number) {
  const event = new Event(type) as TouchEvent;
  if (clientY !== undefined) {
    Object.defineProperty(event, "touches", { value: [{ clientY }] });
  }
  document.dispatchEvent(event);
}

/** A full pull gesture: start, one move, then release or cancel. */
function pullGesture(startY: number, distance: number, release: TouchType = "touchend") {
  fireTouch("touchstart", startY);
  fireTouch("touchmove", startY + distance);
  fireTouch(release);
}

/** Temporarily replace window.scrollY for the duration of `run` (jsdom can't really scroll). */
function withScrollY(value: number, run: () => void) {
  const original = Object.getOwnPropertyDescriptor(window, "scrollY");
  let current = value;
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => current,
    set: (next: number) => {
      current = next;
    },
  });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(window, "scrollY", original);
  }
}

describe("PullToRefresh", () => {
  afterEach(() => vi.restoreAllMocks());

  it("calls onRefresh after a pull past the threshold", () => {
    const onRefresh = vi.fn();
    render(<PullToRefresh onRefresh={onRefresh}>Resting</PullToRefresh>);
    pullGesture(100, 172); // 86 px of indicator travel > the 64 px threshold
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("ignores a pull shorter than the threshold", () => {
    const onRefresh = vi.fn();
    render(<PullToRefresh onRefresh={onRefresh}>Resting</PullToRefresh>);
    pullGesture(100, 100); // 50 px < 64 px
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("is not armed when the page is scrolled away from the top", () => {
    const onRefresh = vi.fn();
    withScrollY(40, () => {
      render(<PullToRefresh onRefresh={onRefresh}>Resting</PullToRefresh>);
      pullGesture(100, 400);
    });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("stops counting as soon as the page scrolls during the drag", () => {
    let scroll = 0;
    const original = Object.getOwnPropertyDescriptor(window, "scrollY");
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => scroll,
      set: (next: number) => {
        scroll = next;
      },
    });
    try {
      const onRefresh = vi.fn();
      render(<PullToRefresh onRefresh={onRefresh}>Resting</PullToRefresh>);
      fireTouch("touchstart", 100);
      fireTouch("touchmove", 300); // armed and far past the threshold
      scroll = 10; // the finger scrolled the page instead of pulling
      fireTouch("touchmove", 400);
      fireTouch("touchend");
      expect(onRefresh).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(window, "scrollY", original);
    }
  });

  it("treats a cancelled touch as a release without a refresh", () => {
    const onRefresh = vi.fn();
    render(<PullToRefresh onRefresh={onRefresh}>Resting</PullToRefresh>);
    pullGesture(100, 200, "touchcancel");
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

describe("Toast", () => {
  it("shows while visible and calls onDone after 2 s", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container, unmount } = render(
      <Toast message="Updated just now" visible onDone={onDone} />,
    );
    expect(screen.getByText("Updated just now")).toBeInTheDocument();
    expect(container.querySelector("[role='status']")).toHaveAttribute("aria-hidden", "false");

    act(() => vi.advanceTimersByTime(1999));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledOnce();
    unmount();
  });

  it("stays mounted but hidden when not visible", () => {
    render(<Toast message="Updated just now" visible={false} onDone={() => undefined} />);
    const status = document.body.querySelector("[role='status']");
    expect(status).not.toBeNull();
    expect(status).toHaveAttribute("aria-hidden", "true");
  });
});
