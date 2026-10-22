import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { resetFamilyNameCache } from "../hooks/useFamilyName";
import { setMockVariant } from "../mocks/variant";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetFamilyNameCache();
  setMockVariant(null);
  window.history.replaceState(null, "", "/");
  vi.useRealTimers();
  vi.restoreAllMocks();
});
