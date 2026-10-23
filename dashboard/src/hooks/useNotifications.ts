import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/** The Web Notifications API permission value, tracked reactively for the prompt banner. */
export type NotificationPermission = "default" | "granted" | "denied";

/** Set by "Not now" in the Today prompt; the banner stays hidden from then on. */
export const NOTIFICATION_DISMISS_KEY = "saathi.notifDismissed";

/**
 * Notification icon: the Saathi shield, filled with the accent teal, as a data URL. Web
 * Notifications need an absolute URL they can fetch — a data URL avoids a public/ asset.
 */
export const NOTIFICATION_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#0f6f68" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
)}`;

const notificationApi = (): typeof Notification | undefined =>
  typeof window !== "undefined" && "Notification" in window ? window.Notification : undefined;

/**
 * Thin wrapper over the Web Notifications API that degrades gracefully where it's missing
 * (tests, SSR, old browsers): `permission` is then "denied", `notify()` no-ops.
 *
 * `notify` reads the live permission from the API rather than the reactive state, so granting
 * it through one prompt instance lets every other one fire immediately.
 * Clicking a notification focuses the tab and jumps to Today.
 */
export function useNotifications() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const [permission, setPermission] = useState<NotificationPermission>(
    () => notificationApi()?.permission ?? "denied",
  );

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    const api = notificationApi();
    if (!api) return "denied";
    const result = await api.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const notify = useCallback(
    (title: string, options: NotificationOptions = {}) => {
      const api = notificationApi();
      if (!api || api.permission !== "granted") return undefined;
      const notification = new api(title, { icon: NOTIFICATION_ICON, ...options });
      notification.addEventListener("click", () => {
        notification.close();
        window.focus();
        navigateRef.current("/");
      });
      return notification;
    },
    [],
  );

  return { permission, requestPermission, notify };
}
