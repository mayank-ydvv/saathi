import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ensureFresh, useSession } from "./session";

/** Sends visitors without a session to /login, remembering where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    void ensureFresh().finally(() => alive && setChecked(true));
    return () => {
      alive = false;
    };
  }, []);

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!checked && session.expiresAt < Date.now()) return null; // renewing an expired token
  return <>{children}</>;
}
