import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TimelineEvent } from "../api/types";
import { VisitorPanel } from "./VisitorPanel";

const visiting: TimelineEvent = {
  event_id: "d1",
  ts: "2026-10-22T09:40:00Z",
  zone: "front_door",
  type: "ding",
  snapshot_url: null,
  visitor: {
    summary: "A man at the door, no uniform and no package",
    person_count: 1,
    uniform_or_badge: false,
    carrying_package: false,
    caution: true,
    caution_reason: "unknown visitor, no package",
  },
};

describe("VisitorPanel focus-trap fallback (no showModal)", () => {
  afterEach(() => {
    // restore whatever browser capability the jsdom prototype had
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    vi.restoreAllMocks();
  });

  it("opens non-modally, keeps keyboard focus inside and closes on Escape", async () => {
    (HTMLDialogElement.prototype as unknown as { showModal?: unknown }).showModal = undefined;
    const onClose = vi.fn();
    render(<VisitorPanel event={visiting} onClose={onClose} />);

    const close = screen.getByRole("button", { name: "Close" });
    const dialog = close.closest("dialog");
    expect(dialog).toHaveAttribute("open");

    // Tab from the dialog lands on its only focusable element and stays trapped there.
    await userEvent.tab();
    expect(document.activeElement).toBe(close);
    await userEvent.tab(); // would leave a non-modal element; the trap wraps instead
    expect(document.activeElement).toBe(close);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
