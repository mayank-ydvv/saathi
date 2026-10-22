import React, { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getAlerts, getHome } from "./api/client";
import type { Home } from "./api/types";
import { Header } from "./components/Header";
import { Navigation } from "./components/Navigation";
import { usePolling } from "./hooks/usePolling";
import { AlertsView } from "./views/AlertsView";
import { DigestView } from "./views/DigestView";
import { RoutineView } from "./views/RoutineView";
import { TodayView } from "./views/TodayView";

export function App(): React.ReactElement {
  const [home, setHome] = useState<Home | null>(null);
  const [openAlertCount, setOpenAlertCount] = useState<number>(0);

  useEffect(() => {
    void getHome().then((res) => {
      if (res.success) setHome(res.data);
    });
  }, []);

  // Poll open alert count for badge on navigation tabs
  usePolling(async (signal) => {
    try {
      const res = await getAlerts(undefined, 20, signal);
      if (res.success) {
        const open = res.data.alerts.filter((a) => a.state !== "RESOLVED").length;
        setOpenAlertCount(open);
      }
    } catch {
      // Swallowed on abort
    }
  }, 5000);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-stone-50/50 text-stone-900 dark:bg-stone-950 dark:text-stone-100 flex flex-col antialiased">
        {/* Top Header */}
        <Header
          parentName={home?.parent_name || "Kamala"}
          city={home?.city || "Chennai"}
        />

        {/* Responsive Shell: Desktop Side Nav + Content Area */}
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-stretch">
          <Navigation alertCount={openAlertCount} />

          {/* Main View Area with Mobile Bottom Padding */}
          <main className="flex-1 px-4 py-6 sm:px-8 pb-24 md:pb-10 max-w-4xl">
            <Routes>
              <Route path="/" element={<TodayView />} />
              <Route path="/alerts" element={<AlertsView />} />
              <Route path="/digest" element={<DigestView />} />
              <Route path="/routine" element={<RoutineView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
