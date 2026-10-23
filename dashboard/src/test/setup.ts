import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { resetSessionCache, setSession } from "../auth/session";
import { resetFamilyNameCache } from "../hooks/useFamilyName";
import { setMockVariant } from "../mocks/variant";

// jsdom has no IntersectionObserver (motion's useInView needs one): report everything visible.
class VisibleObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.cb([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", VisibleObserver);

// Screens behind the login gate render as a signed-in family member by default; the auth
// tests sign out first. An empty name keeps the default "Family" ack name.
export const TEST_SESSION = {
  email: "family@example.com",
  name: "",
  idToken: "t",
  accessToken: "t",
  refreshToken: "t",
  expiresAt: Date.now() + 24 * 3600_000,
};

beforeEach(() => {
  setSession(TEST_SESSION);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetFamilyNameCache();
  resetSessionCache();
  setMockVariant(null);
  window.history.replaceState(null, "", "/");
  vi.useRealTimers();
  vi.restoreAllMocks();
});
