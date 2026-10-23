import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import { istToUtc, shiftDateKey, TIMEZONE } from "../lib/time";

const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, weekday: "short" });
const dayNum = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, day: "numeric" });
const longDay = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "long" });

/** The last seven days as tappable chips, plus previous / next and a date field for older days. */
export function DayPicker({
  id,
  date,
  today,
  onChange,
}: {
  id: string;
  date: string;
  today: string;
  onChange: (date: string) => void;
}) {
  const week = Array.from({ length: 7 }, (_, i) => shiftDateKey(today, i - 6));
  const arrow =
    "press grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface hover:bg-surface-2 disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onChange(shiftDateKey(date, -1))} className={arrow} aria-label="Previous day">
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <div role="group" aria-label="Last seven days" className="flex gap-1.5 overflow-x-auto">
        {week.map((d) => {
          const at = istToUtc(d, "12:00");
          const active = d === date;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              aria-label={longDay.format(at)}
              onClick={() => onChange(d)}
              className={cn(
                "press flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 transition-colors",
                active ? "bg-accent text-accent-ink shadow-card" : "bg-surface text-muted shadow-card hover:text-ink",
              )}
            >
              <span className="text-[11px] font-bold uppercase">{d === today ? "Today" : weekday.format(at)}</span>
              <span className="display text-lg leading-tight font-semibold">{dayNum.format(at)}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftDateKey(date, 1))}
        disabled={date >= today}
        className={arrow}
        aria-label="Next day"
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
      <label className="sr-only" htmlFor={id}>
        Date
      </label>
      <input
        id={id}
        type="date"
        value={date}
        max={today}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-10 rounded-xl border border-line bg-surface px-3 text-[15px]"
      />
    </div>
  );
}
