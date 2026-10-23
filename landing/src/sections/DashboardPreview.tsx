import { Reveal, SectionHeading } from "../components/Reveal";
import { NumberTicker } from "../components/ui/NumberTicker";
import { Safari } from "../components/ui/Safari";
import { DASHBOARD_URL } from "../config";

// Real numbers from the engine and the end-to-end runs (docs/E2E_RESULTS.md).
const FACTS: { value: number; unit: string; label: string }[] = [
  { value: 96, unit: "", label: "15-minute slots learned per room, every day" },
  { value: 14, unit: " days", label: "of routine behind every “usual”" },
  { value: 4, unit: " steps", label: "on the ladder, from grace period to neighbour" },
  { value: 2, unit: " s", label: "from alert to the nudge on Ma's screen, in our test" },
];

/** The family dashboard in a Safari window (Magic UI "Safari"), with number-ticker facts. */
export function DashboardPreview() {
  return (
    <section className="bg-linen py-[100px] sm:py-[140px]" aria-label="The family dashboard">
      <SectionHeading title="Everything about today, in one calm place">
        Status, the day's timeline, open alerts and the evening digest. The family logs in with
        their email, and everyone sees the same picture.
      </SectionHeading>
      <Reveal className="mx-auto mt-14 max-w-[1000px] px-4">
        <Safari url="saathi · family dashboard" imageSrc="/screens/dashboard-today.jpg" className="w-full" />
      </Reveal>
      <div className="mx-auto mt-14 grid max-w-[1000px] grid-cols-2 gap-x-6 gap-y-10 px-4 sm:grid-cols-4">
        {FACTS.map((f, i) => (
          <Reveal key={f.label} delay={i * 100}>
            <div className="flare text-[48px] leading-none text-graphite">
              <NumberTicker value={f.value} className="text-graphite" />
              <span className="text-[28px]">{f.unit}</span>
            </div>
            <p className="mt-2 text-body text-slate">{f.label}</p>
          </Reveal>
        ))}
      </div>
      <div className="mt-12 text-center">
        <a
          href={DASHBOARD_URL}
          className="inline-flex h-10 items-center rounded-[4px] bg-deep-ink px-5 text-body text-white"
        >
          Log in to the dashboard →
        </a>
      </div>
    </section>
  );
}
