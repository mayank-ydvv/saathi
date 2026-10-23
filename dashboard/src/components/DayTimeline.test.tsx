import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TimelineEvent } from "../api/types";
import { DayTimeline } from "./DayTimeline";

const event = (id: string, hour: number): TimelineEvent => ({
  event_id: id,
  ts: `2026-10-22T${String(hour).padStart(2, "0")}:30:00Z`,
  zone: "kitchen",
  type: "motion",
  snapshot_url: null,
  visitor: null,
});

describe("DayTimeline keyboard navigation", () => {
  it("keeps one mark per lane in the tab order and moves with Left/Right, Home and End", async () => {
    render(
      <DayTimeline
        events={[event("e1", 1), event("e2", 3), event("e3", 5)]}
        zones={["kitchen"]}
        now={null}
        onVisitor={vi.fn()}
      />,
    );
    const lane = screen.getByRole("group", { name: "Kitchen: 3 events" });
    const marks = within(lane).getAllByRole("button");
    expect(marks).toHaveLength(3);

    // Tab reaches the lane once: only the first mark is tabbable.
    expect(marks[0]).toHaveAttribute("tabindex", "0");
    expect(marks[1]).toHaveAttribute("tabindex", "-1");
    expect(marks[2]).toHaveAttribute("tabindex", "-1");
    await userEvent.tab();
    expect(document.activeElement).toBe(marks[0]);

    // Arrows move within the lane and keep exactly one active item.
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(marks[1]);
    expect(marks[1]).toHaveAttribute("tabindex", "0");
    expect(marks[0]).toHaveAttribute("tabindex", "-1");

    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(marks[2]);

    await userEvent.keyboard("{ArrowRight}"); // wraps to the first mark
    expect(document.activeElement).toBe(marks[0]);

    await userEvent.keyboard("{ArrowLeft}"); // wraps backwards to the last one
    expect(document.activeElement).toBe(marks[2] ?? null);

    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(marks[0]);

    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(marks[2] ?? null);
  });
});
