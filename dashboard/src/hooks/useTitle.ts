import { useEffect } from "react";

/** "Alerts · Saathi" in the browser tab, so each screen is announced and bookmarkable. */
export function useTitle(screen: string): void {
  useEffect(() => {
    document.title = `${screen} · Saathi`;
  }, [screen]);
}
