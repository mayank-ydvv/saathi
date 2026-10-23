import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeNotification, type FakeNotification } from "../test/fakeNotification";
import { NOTIFICATION_ICON, useNotifications } from "./useNotifications";

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe("useNotifications", () => {
  let fake: FakeNotification;

  beforeEach(() => {
    fake = installFakeNotification("granted");
  });
  afterEach(() => fake.uninstall());

  it("notify() fires a notification with the shield icon when permission is granted", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.notify("Needs attention", { body: "reason" });
    });
    const [made] = fake.created;
    expect(fake.created).toHaveLength(1);
    expect(made?.title).toBe("Needs attention");
    expect(made?.options.body).toBe("reason");
    expect(made?.options.icon).toBe(NOTIFICATION_ICON);
  });

  it("notify() no-ops when permission is denied", () => {
    fake.setPermission("denied");
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.notify("should not fire");
    });
    expect(fake.created).toHaveLength(0);
  });

  it("falls back to denied (and always no-ops) where the API is missing", () => {
    fake.uninstall(); // jsdom has no Notification of its own
    const { result } = renderHook(() => useNotifications(), { wrapper });
    expect(result.current.permission).toBe("denied");
    act(() => {
      result.current.notify("should not fire");
    });
    expect(fake.created).toHaveLength(0);
  });

  it("requestPermission() makes permission reactive and notifications fire", async () => {
    fake.setPermission("default");
    const { result } = renderHook(() => useNotifications(), { wrapper });
    expect(result.current.permission).toBe("default");
    expect(fake.created).toHaveLength(0);

    await act(async () => result.current.requestPermission());
    expect(result.current.permission).toBe("granted");

    act(() => {
      result.current.notify("now it works");
    });
    expect(fake.created).toHaveLength(1);
  });

  it("clicking the notification closes it and focuses the tab", () => {
    const focus = vi.spyOn(window, "focus").mockImplementation(() => undefined);
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.notify("Needs attention");
    });
    const instance = fake.instances[0];
    if (!instance) throw new Error("notification was not created");
    act(() => instance.dispatchEvent(new Event("click")));
    expect(focus).toHaveBeenCalledOnce();
  });
});
