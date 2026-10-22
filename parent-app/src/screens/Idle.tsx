import { TIMEZONE } from "../config";
import { localHour, useNow } from "../hooks";
import { dayPart, STRINGS, type Lang } from "../i18n";

/** Big clock, date and a greeting. Nothing to press. */
export function IdleScreen({ lang, name }: { lang: Lang; name: string }) {
  const now = useNow();
  const t = STRINGS[lang];
  const time = new Intl.DateTimeFormat(t.locale, {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
  const date = new Intl.DateTimeFormat(t.locale, {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const greeting = t.greeting[dayPart(localHour(now))];

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-[clamp(4.5rem,18vw,11rem)] leading-none font-bold tabular-nums">
        {time}
      </p>
      <p className="text-[clamp(2rem,6vw,3.5rem)] text-soft-ink">{date}</p>
      <h1 className="text-[clamp(2.5rem,8vw,4.5rem)] font-semibold">
        {name ? `${greeting}, ${name}` : greeting}
      </h1>
    </main>
  );
}
