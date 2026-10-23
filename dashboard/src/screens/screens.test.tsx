import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "../App";
import { StatusCard } from "../components/StatusCard";
import { ROUTER_FUTURE } from "../routerFuture";

function renderAt(path: string) {
  window.history.replaceState(null, "", path); // the mock reads ?mock= from the page URL
  return render(
    <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("StatusCard", () => {
  it("shows word, reason and last seen, inside a polite live region", () => {
    render(
      <StatusCard
        now={new Date("2026-10-22T04:00:00Z")}
        status={{
          home_id: "home-demo-1",
          status: "red",
          reason: "No kitchen movement by 10:15 (usually 08:05)",
          last_seen: { zone: "kitchen", ts: "2026-10-22T03:48:00Z" },
          active_alert_id: "a",
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByText(/No kitchen movement by 10:15/)).toBeInTheDocument();
    expect(screen.getByText(/12 min ago/)).toBeInTheDocument();
    const live = screen.getByText("Needs attention").closest("[aria-live]");
    expect(live).toHaveAttribute("aria-live", "polite");
  });
});

describe("screens with mock data", () => {
  it("Today: 'I'm checking' resolves the open alert and the status turns green", async () => {
    renderAt("/?mock=red");
    expect(await screen.findByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    const banner = await screen.findByRole("region", { name: "Open alert" });
    expect(within(banner).getByText("Alerted family")).toBeInTheDocument();

    await userEvent.click(within(banner).getByRole("button", { name: /I'm checking/ }));
    expect(await screen.findByRole("heading", { name: "All normal" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Open alert" })).not.toBeInTheDocument();
    expect(screen.getByText("Thanks, Family. Everyone can see you're checking.")).toBeInTheDocument();
  });

  it("Today: the parent's number becomes a Call link", async () => {
    renderAt("/?mock=green");
    expect(await screen.findByRole("heading", { name: "All normal" })).toBeInTheDocument();
    const calls = await screen.findAllByRole("link", { name: "Call Kamala" });
    expect(calls[0]).toHaveAttribute("href", "tel:+919876543210");
  });

  it("the demo switch changes the status in place and keeps it across tabs", async () => {
    renderAt("/?mock=green");
    expect(await screen.findByRole("heading", { name: "All normal" })).toBeInTheDocument();
    const demo = screen.getByRole("group", { name: "Demo status" });
    expect(within(demo).getByRole("button", { name: "Normal" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(within(demo).getByRole("button", { name: "Alert" }));
    expect(await screen.findByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(within(demo).getByRole("button", { name: "Alert" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(within(demo).getByRole("button", { name: "Checking" }));
    expect(await screen.findByRole("heading", { name: "Checking in" })).toBeInTheDocument();
    const alertsTab = screen.getAllByRole("link", { name: /Alerts/ })[0];
    expect(alertsTab).toHaveAttribute("href", "/alerts?mock=yellow");
  });

  it("Today: green has no alert banner and draws the four zone lanes", async () => {
    renderAt("/?mock=green");
    expect(await screen.findByRole("heading", { name: "All normal" })).toBeInTheDocument();
    expect(await screen.findByRole("group", { name: /^Kitchen: \d+ events$/ })).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /events$/ })).toHaveLength(4);
    expect(screen.queryByRole("region", { name: "Open alert" })).not.toBeInTheDocument();
  });

  it("Alerts: newest first with steps, and who resolved it", async () => {
    renderAt("/alerts?mock=red");
    expect(await screen.findByText("Resolved by Priya in 16 min")).toBeInTheDocument();
    const lists = screen.getAllByRole("list", { name: "Escalation steps" });
    expect(lists[0]).toHaveTextContent("Alerted family");
    expect(screen.getByText("Resolved by Kamala in 3 min")).toBeInTheDocument();
  });

  it("Digest: empty before 9 pm today, text for yesterday", async () => {
    renderAt("/digest?mock=green");
    expect(await screen.findByText("No digest yet — it arrives at 9 pm")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Read yesterday's" }));
    expect(await screen.findByText(/Kamala started her day later than usual/)).toBeInTheDocument();
  });

  it("Routine: a chart and usual time per zone", async () => {
    renderAt("/routine?mock=green");
    expect(await screen.findByRole("img", { name: /^Kitchen: most active around/ })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /most active around/ })).toHaveLength(4);
    expect(screen.getByText("07:40")).toBeInTheDocument();
  });

  it("Alerts: the Open filter hides resolved alerts", async () => {
    renderAt("/alerts?mock=red");
    expect(await screen.findByText("Resolved by Priya in 16 min")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("group", { name: "Show alerts" })).getByRole("button", { name: /^Open/ }));
    expect(screen.queryByText("Resolved by Priya in 16 min")).not.toBeInTheDocument();
    expect(screen.getAllByRole("list", { name: "Escalation steps" })).toHaveLength(1);
  });

  it("Visitors: each doorbell ring with its description, strangers flagged", async () => {
    renderAt("/visitors?mock=green&time=21:30");
    expect(await screen.findByText("One person in a delivery uniform holding a cardboard box.")).toBeInTheDocument();
    expect(screen.getAllByText("Caution").length).toBeGreaterThan(0);
    expect(screen.getByText("No uniform, badge or package visible")).toBeInTheDocument();
  });

  it("Family: who each step of the ladder reaches", async () => {
    renderAt("/family?mock=green");
    const ladder = await screen.findByRole("list", { name: "Who is reached at each step" });
    expect(await within(ladder).findByText("Mrs Iyer")).toBeInTheDocument();
    expect(within(ladder).getByText("Priya")).toBeInTheDocument();
    expect(within(ladder).getAllByText("Kamala").length).toBeGreaterThan(0);
  });
});
