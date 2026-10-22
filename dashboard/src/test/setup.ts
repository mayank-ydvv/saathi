import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { resetFamilyNameCache } from "../hooks/useFamilyName";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetFamilyNameCache();
  window.history.replaceState(null, "", "/");
  vi.useRealTimers();
  vi.restoreAllMocks();
});
