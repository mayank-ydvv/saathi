import { useState } from "react";
import { getDigest } from "../api/client";
import { Icon } from "../components/Icon";
import { Card, Empty, ErrorCard, Loading, PageTitle } from "../components/States";
import { usePolling } from "../hooks/usePolling";
import { useNow } from "../hooks/useNow";
import { formatDateIST, formatTimeIST, istToUtc, shiftDateKey, todayIST } from "../lib/time";

export function Digest() {
  const now = useNow();
  const today = todayIST(now);
  const [date, setDate] = useState(today);
  const digest = usePolling((signal) => getDigest(date, { signal }), null, date);
  const label = formatDateIST(istToUtc(date, "12:00"));

  return (
    <>
      <PageTitle sub="A short summary of the day, written every evening at 9 pm.">Evening digest</PageTitle>

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDate(shiftDateKey(date, -1))}
          className="rounded-xl border border-line p-2.5 hover:bg-surface-2"
          aria-label="Previous day"
        >
          <Icon name="chevronLeft" className="h-5 w-5" />
        </button>
        <label className="sr-only" htmlFor="digest-date">
          Date
        </label>
        <input
          id="digest-date"
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-[15px]"
        />
        <button
          type="button"
          onClick={() => setDate(shiftDateKey(date, 1))}
          disabled={date >= today}
          className="rounded-xl border border-line p-2.5 hover:bg-surface-2 disabled:opacity-40"
          aria-label="Next day"
        >
          <Icon name="chevronRight" className="h-5 w-5" />
        </button>
      </div>

      {digest.data ? (
        <Card className="md:p-8">
          <p className="text-sm font-semibold text-muted">{label}</p>
          <p className="mt-3 max-w-prose text-[18px] leading-relaxed">{digest.data.text}</p>
          <p className="mt-4 text-sm text-muted">Written at {formatTimeIST(digest.data.generated_at)}</p>
        </Card>
      ) : digest.error?.kind === "not_found" ? (
        <Empty title={date === today ? "No digest yet — it arrives at 9 pm" : `No digest for ${label}`}>
          {date === today ? (
            <button
              type="button"
              onClick={() => setDate(shiftDateKey(today, -1))}
              className="mt-2 font-medium text-accent underline-offset-4 hover:underline"
            >
              Read yesterday's
            </button>
          ) : null}
        </Empty>
      ) : digest.error ? (
        <ErrorCard what="the digest" error={digest.error} onRetry={digest.refresh} />
      ) : (
        <Loading label="Loading the digest" lines={4} />
      )}
    </>
  );
}
