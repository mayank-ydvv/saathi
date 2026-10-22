import { useEffect, useState } from "react";
import { getHome, getStatus } from "./api/client";
import type { Home, Status } from "./api/types";
import { config } from "./config";

/** Phase 1 placeholder: proves the client and mock data work. The screens arrive in Phase 2. */
export default function App() {
  const [home, setHome] = useState<Home | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void getHome({ signal: ctrl.signal }).then((r) => r.ok && setHome(r.data));
    void getStatus({ signal: ctrl.signal }).then((r) => r.ok && setStatus(r.data));
    return () => ctrl.abort();
  }, []);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Saathi</h1>
      <p className="text-muted">
        {home ? `${home.parent_name} · ${home.city}` : "Loading…"}
        {config.useMock ? " · mock data" : ""}
      </p>
      <p className="mt-4 rounded-2xl bg-surface p-4 shadow-card">
        Status: {status ? status.status : "…"}
        {status?.reason ? ` — ${status.reason}` : ""}
      </p>
    </main>
  );
}
