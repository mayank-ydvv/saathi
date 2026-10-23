import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Api, Nudge } from "./api";
import { App } from "./App";

const IDLE: Nudge = { active: false, alert_id: null, message: null, audio_url: null };
const ACTIVE: Nudge = {
  active: true,
  alert_id: "alt_1",
  message: "Good morning Kamala, are you okay? Please press the green button.",
  audio_url: "http://api.test/blobs/audio/nudge.mp3",
};

/** A fake backend whose nudge the test switches on and off. */
function fakeApi(initial: Nudge = IDLE) {
  let current = initial;
  const api = {
    getHome: vi.fn(async () => ({ home_id: "home-demo-1", parent_name: "Kamala" })),
    getNudge: vi.fn(async () => current),
    ack: vi.fn(async () => {
      current = IDLE;
    }),
  } satisfies Api;
  return { api, set: (n: Nudge) => (current = n) };
}

async function tick(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

/** Tap a button and let the resulting promises and re-renders settle. */
async function tap(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

/** Render, then tap "turn on sound" as the parent does after every page load (M6). */
async function setup(api: Api) {
  render(<App api={api} />);
  await tap("Tap to turn on Saathi");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T03:00:00Z")); // 08:30 in Asia/Kolkata
});

describe("parent app", () => {
  it("asks for one tap to turn sound on after every page load (M6)", async () => {
    window.localStorage.setItem("saathi.soundOn", "true"); // an old tablet's stored value
    render(<App api={fakeApi().api} />);
    await tap("Tap to turn on Saathi");
    expect(window.localStorage.getItem("saathi.soundOn")).toBe("true"); // ignored, not rewritten
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
    await tick(0);
    expect(screen.getByRole("heading", { name: "Good morning, Kamala" })).toBeInTheDocument();
  });

  it("shows the nudge when polling turns active, and plays the voice", async () => {
    const { api, set } = fakeApi();
    await setup(api);
    await tick(0);
    expect(screen.queryByText("Are you okay?")).not.toBeInTheDocument();

    set(ACTIVE);
    await tick(3_000);
    expect(screen.getByRole("alertdialog", { name: "Are you okay?" })).toBeInTheDocument();
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("acknowledges as the parent, thanks for 5 s, then returns to the clock", async () => {
    const { api } = fakeApi(ACTIVE);
    await setup(api);
    await tick(0);

    await tap("I'm okay");
    expect(api.ack).toHaveBeenCalledWith("alt_1", "Kamala");
    expect(screen.getByText("Thank you. Your family has been told you're okay.")).toBeVisible();

    await tick(5_000);
    expect(screen.getByRole("heading", { name: "Good morning, Kamala" })).toBeInTheDocument();
  });

  it("asks again if the acknowledgement cannot be sent", async () => {
    const { api } = fakeApi(ACTIVE);
    api.ack.mockRejectedValueOnce(new Error("offline"));
    await setup(api);
    await tick(0);

    await tap("I'm okay");
    expect(screen.getByText("Could not send. Please press again.")).toBeVisible();
    expect(screen.getByRole("button", { name: "I'm okay" })).toBeEnabled();
  });

  it("goes back to the clock without thanks when the family resolves it", async () => {
    const { api, set } = fakeApi(ACTIVE);
    await setup(api);
    await tick(0);
    expect(screen.getByText("Are you okay?")).toBeInTheDocument();

    set(IDLE);
    await tick(3_000);
    expect(screen.queryByText("Are you okay?")).not.toBeInTheDocument();
    expect(screen.queryByText(/Thank you/)).not.toBeInTheDocument();
  });

  it("switches every on-screen text to Hindi and remembers the choice", async () => {
    const { api } = fakeApi(ACTIVE);
    await setup(api);
    await tick(0);

    await tap("हिन्दी में बदलें");
    expect(screen.getByRole("heading", { name: "क्या आप ठीक हैं?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "मैं ठीक हूँ" })).toBeInTheDocument();
    expect(screen.getByText("कृपया हरा बटन दबाएँ।")).toBeInTheDocument();
    expect(window.localStorage.getItem("saathi.lang")).toBe("hi");

    await tap("Switch to English");
    expect(screen.getByRole("button", { name: "I'm okay" })).toBeInTheDocument();
  });

  it("in Hindi speaks Hindi instead of the English clip (M5)", async () => {
    const { api } = fakeApi(ACTIVE);
    await setup(api);
    await tap("हिन्दी में बदलें");
    vi.mocked(window.HTMLMediaElement.prototype.play).mockClear();
    vi.mocked(window.speechSynthesis.speak).mockClear();
    await tick(30_000);
    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });
});
