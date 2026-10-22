import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no media playback or speech synthesis.
window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = vi.fn();
Object.defineProperty(window, "speechSynthesis", {
  configurable: true,
  value: { speak: vi.fn(), cancel: vi.fn() },
});
vi.stubGlobal(
  "SpeechSynthesisUtterance",
  class {
    lang = "";
    rate = 1;
    constructor(public text: string) {}
  },
);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
});
