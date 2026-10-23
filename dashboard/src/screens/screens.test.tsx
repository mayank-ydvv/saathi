import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppRoutes } from "../App";
import { StatusCard } from "../components/StatusCard";
import { NOTIFICATION_DISMISS_KEY } from "../hooks/useNotifications";
import { ROUTER_FUTURE } from "../routerFuture";
import { installFakeNotification, type FakeNotification } from "../test/fakeNotification";

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
});

describe("Notification prompt on Today", () => {
  let fake: FakeNotification;

  beforeEach(() => fake = installFakeNotification("default"));
  afterEach(() => fake.uninstall());

  it("prompts while permission is default, and Enable asks for it", async () => {
    renderAt("/?mock=green");
    const prompt = await screen.findByRole("note", { name: "Notification prompt" });
    expect(fake.requestPermission).not.toHaveBeenCalled();
    await userEvent.click(within(prompt).getByRole("button", { name: "Enable" }));
    expect(fake.requestPermission).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "All normal" })).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: "Notification prompt" })).not.toBeInTheDocument();
  });

  it("Not now dismisses it for the session and on the next visit", async () => {
    renderAt("/?mock=green");
    const prompt = await screen.findByRole("note", { name: "Notification prompt" });
    await userEvent.click(within(prompt).getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("note", { name: "Notification prompt" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(NOTIFICATION_DISMISS_KEY)).toBe("1");

    // A fresh mount reads the remembered flag and stays quiet.
    renderAt("/?mock=green");
    expect(await screen.findByRole("heading", { name: "All normal" })).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: "Notification prompt" })).not.toBeInTheDocument();
  });
});
