import Lenis from "lenis";
import { useEffect } from "react";
import { PhotoPicker } from "./components/PhotoPicker";
import { DASHBOARD_URL } from "./config";
import { reducedMotion } from "./lib/motion";
import { Closing } from "./sections/Closing";
import { DashboardPreview } from "./sections/DashboardPreview";
import { Effortless } from "./sections/Effortless";
import { Family } from "./sections/Family";
import { Guardian } from "./sections/Guardian";
import { HowItWorks } from "./sections/HowItWorks";
import { Ladder } from "./sections/Ladder";
import { Nudge } from "./sections/Nudge";
import { Story } from "./sections/Story";

function Nav() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex h-[70px] items-center justify-between px-4 sm:px-[34px]">
      <a href="#" className="flex items-center gap-2 text-white" aria-label="Saathi home">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
          {[0, 60, 120].map((r) => (
            <ellipse key={r} cx="12" cy="12" rx="4" ry="10" transform={`rotate(${r} 12 12)`} />
          ))}
        </svg>
        <span className="flare text-[22px]">saathi</span>
      </a>
      <nav className="flex items-center rounded-[6px] bg-white p-[3px] text-[14px]">
        <a href="#how" className="px-3 py-1 text-deep-ink">
          How it works
        </a>
        <a href={DASHBOARD_URL} className="rounded-[4px] bg-deep-ink px-3 py-1 text-white">
          Open dashboard
        </a>
      </nav>
    </header>
  );
}

export function App() {
  useEffect(() => {
    if (reducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return (
    <main className="relative">
      <Nav />
      <Story />
      <div
        id="how"
        style={{
          background:
            "radial-gradient(50% 30% at 85% 8%, #f3e4d8 0%, transparent 70%), radial-gradient(45% 25% at 10% 40%, #efe6ee 0%, transparent 70%), radial-gradient(50% 30% at 90% 75%, #f2e9da 0%, transparent 70%), #f7f5f1",
        }}
      >
        <Guardian />
        <Effortless />
        <HowItWorks />
        <Nudge />
        <Ladder />
        <Family />
      </div>
      <DashboardPreview />
      <Closing />
      {import.meta.env.DEV && <PhotoPicker />}
    </main>
  );
}
