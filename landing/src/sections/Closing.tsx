import { Reveal } from "../components/Reveal";
import { DASHBOARD_URL, REPO_URL } from "../config";

/** Closing call to action and the dark olive footer strip from DESIGN.md. */
export function Closing() {
  return (
    <>
      <section className="bg-linen px-4 py-[120px] text-center sm:py-[160px]">
        <Reveal>
          <div className="text-caption uppercase text-slate">Saathi</div>
          <h2 className="flare mx-auto mt-4 max-w-[640px] text-[38px] sm:text-display">
            Peace of mind for you. Dignity for them.
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-body-lg text-slate">
            No cameras to watch, no buttons to wear. Just a quiet companion that knows what a normal
            day looks like.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={DASHBOARD_URL}
              className="inline-flex h-10 items-center rounded-[4px] bg-deep-ink px-5 text-body text-white"
            >
              Open the family dashboard →
            </a>
            <a
              href={REPO_URL}
              className="inline-flex h-10 items-center rounded-[6px] border border-deep-ink bg-white px-[18px] text-body text-deep-ink"
            >
              See the code
            </a>
          </div>
        </Reveal>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-olive px-4 py-4 text-caption text-white sm:px-[34px]">
        <span>Saathi · Amazon Developer Hackathon 2026</span>
        <nav className="flex flex-wrap gap-5" aria-label="Footer">
          <a href={REPO_URL}>GitHub</a>
          <a href={`${REPO_URL}/blob/main/docs/OPEN_SOURCE.md`}>Open source</a>
          <a href={`${REPO_URL}/blob/main/LICENSE`}>MIT licence</a>
          <a href={`${REPO_URL}/blob/main/landing/README.md#photo-credits`}>Photo credits</a>
        </nav>
      </footer>
    </>
  );
}
