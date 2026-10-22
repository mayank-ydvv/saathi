import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Status } from "../api/types";
import { StatusCard } from "../components/StatusCard";

describe("StatusCard Component", () => {
  it("renders green status with 'All normal' and last seen information", () => {
    const mockStatus: Status = {
      home_id: "home-demo-1",
      status: "green",
      reason: null,
      last_seen: {
        zone: "kitchen",
        ts: new Date().toISOString(),
      },
      active_alert_id: null,
    };

    render(<StatusCard status={mockStatus} />);
    expect(screen.getByText("All normal")).toBeInTheDocument();
    expect(screen.getByText(/Last seen: Kitchen/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Home Status: All normal/i)).toBeInTheDocument();
  });

  it("renders yellow status with 'Checking in' and reason text", () => {
    const mockStatus: Status = {
      home_id: "home-demo-1",
      status: "yellow",
      reason: "Grace period: checking morning kitchen routine",
      last_seen: {
        zone: "bedroom",
        ts: new Date().toISOString(),
      },
      active_alert_id: "alt_demo_yellow",
    };

    render(<StatusCard status={mockStatus} />);
    expect(screen.getByText("Checking in")).toBeInTheDocument();
    expect(screen.getByText(/Grace period: checking morning kitchen routine/i)).toBeInTheDocument();
    expect(screen.getByText(/Last seen: Bedroom/i)).toBeInTheDocument();
  });

  it("renders red status with 'Needs attention' and alert reason", () => {
    const mockStatus: Status = {
      home_id: "home-demo-1",
      status: "red",
      reason: "No movement anywhere for 4 hours",
      last_seen: {
        zone: "living_room",
        ts: new Date().toISOString(),
      },
      active_alert_id: "alt_demo_red",
    };

    render(<StatusCard status={mockStatus} />);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText(/No movement anywhere for 4 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/Last seen: Living Room/i)).toBeInTheDocument();
  });
});
