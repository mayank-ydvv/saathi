import { STRINGS, type Lang } from "../i18n";

/** Shown for 5 s after "I'm okay" is accepted. */
export function ThanksScreen({ lang }: { lang: Lang }) {
  return (
    <main
      role="status"
      className="flex flex-1 items-center justify-center bg-ok px-6 text-center text-white"
    >
      <h1 className="max-w-4xl text-[clamp(2.75rem,8vw,5.5rem)] leading-tight font-bold">
        {STRINGS[lang].thanks}
      </h1>
    </main>
  );
}
