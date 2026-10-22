import { STRINGS, type Lang } from "../i18n";

/** Browsers block sound until the first tap; this one big button is that tap. */
export function UnlockScreen({ lang, onUnlock }: { lang: Lang; onUnlock: () => void }) {
  const t = STRINGS[lang];
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 text-center">
      <button
        type="button"
        onClick={onUnlock}
        className="min-h-[50vh] w-full max-w-3xl rounded-3xl bg-ok px-6 text-[clamp(2.5rem,8vw,5rem)] leading-tight font-bold text-white hover:bg-ok-hover focus-visible:outline-8 focus-visible:outline-offset-4 focus-visible:outline-ink"
      >
        {t.unlock}
      </button>
      <p className="text-[clamp(1.75rem,5vw,2.75rem)] text-soft-ink">{t.unlockHint}</p>
    </main>
  );
}
