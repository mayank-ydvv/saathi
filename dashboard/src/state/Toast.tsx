/* eslint-disable react-refresh/only-export-components -- provider + its hook belong together */
import { CircleCheck, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface ToastApi {
  /** Show a short confirmation at the bottom of the screen for a few seconds. */
  show: (message: string) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });
const SHOW_MS = 4_000;

/** One toast at a time, announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const show = useCallback((m: string) => {
    setMessage(m);
    setKey((k) => k + 1);
  }, []);
  const api = useMemo(() => ({ show }), [show]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [message, key]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8"
      >
        {message ? (
          <div
            key={key}
            className="animate-toast-in pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-accent py-3 pr-2 pl-4 text-accent-ink shadow-lift"
          >
            <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
            <p className="font-medium">{message}</p>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="rounded-lg p-1.5 opacity-80 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
