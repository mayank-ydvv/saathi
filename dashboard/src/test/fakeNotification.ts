import { vi } from "vitest";

export interface CreatedNotification {
  title: string;
  options: NotificationOptions;
}

/**
 * Stand-in for the Web Notifications API (jsdom has none). Installs `window.Notification`
 * with the given permission; call `uninstall()` in cleanup.
 */
export function installFakeNotification(permission: string) {
  const created: CreatedNotification[] = [];
  const instances: EventTarget[] = [];

  class FakeNotification extends EventTarget {
    static permission = permission;
    static requestPermission = vi.fn(async () => {
      FakeNotification.permission = "granted";
      return "granted";
    });
    static created = created;
    static instances = instances;

    options: NotificationOptions;

    constructor(title: string, options: NotificationOptions = {}) {
      super();
      created.push({ title, options });
      instances.push(this);
      this.options = options;
    }

    close() {
      // nothing: tests can listen for "close" events themselves
    }
  }

  window.Notification = FakeNotification as unknown as typeof Notification;

  return {
    created,
    instances,
    requestPermission: FakeNotification.requestPermission,
    setPermission: (next: string) => {
      FakeNotification.permission = next;
    },
    permission: () => FakeNotification.permission,
    uninstall: () => {
      Reflect.deleteProperty(window, "Notification");
    },
  };
}

export type FakeNotification = ReturnType<typeof installFakeNotification>;
