import { useEffect } from "react";

/** How long the toast stays up before auto-hiding. */
export const TOAST_MS = 2000;

/** A bottom-of-screen confirmation pill ("Updated just now"). Announces politely. */
export function Toast({
  message,
  visible,
  onDone,
}: {
  message: string;
  visible: boolean;
  /** Called when the toast has been visible for long enough. */
  onDone: () => void;
}) {
  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(onDone, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [visible, onDone]);

  return (
    <p
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-44 z-30 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-medium text-canvas shadow-lg transition-all duration-300 md:bottom-10 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      {message}
    </p>
  );
}
