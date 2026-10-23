import { Check, Copy, MoonStar, PenLine, Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getDigest } from "../api/client";
import { DayPicker } from "../components/DayPicker";
import { HelpNote } from "../components/HelpNote";
import { Card, Empty, ErrorCard, PageTitle, Skeleton } from "../components/States";
import { TextGenerate } from "../components/ui/motion";
import { useNow } from "../hooks/useNow";
import { usePolling } from "../hooks/usePolling";
import { useTitle } from "../hooks/useTitle";
import { formatDateIST, formatTimeIST, istToUtc, shiftDateKey, todayIST } from "../lib/time";

const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function Digest() {
  useTitle("Digest");
  const now = useNow();
  const today = todayIST(now);
  const [date, setDate] = useState(today);
  const digest = usePolling((signal) => getDigest(date, { signal }), null, date);
  const label = formatDateIST(istToUtc(date, "12:00"));

  return (
    <>
      <PageTitle sub="A short note about the day, written every evening at 9 pm.">Evening digest</PageTitle>
      <div className="mb-5">
        <DayPicker id="digest-date" date={date} today={today} onChange={setDate} />
      </div>

      {digest.data ? (
        <Letter key={digest.data.date} label={label} text={digest.data.text} writtenAt={formatTimeIST(digest.data.generated_at)} />
      ) : digest.error?.kind === "not_found" ? (
        <Empty title={date === today ? "No digest yet — it arrives at 9 pm" : `No digest for ${label}`} icon={MoonStar}>
          {date === today ? (
            <button
              type="button"
              onClick={() => setDate(shiftDateKey(today, -1))}
              className="press mt-3 rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink hover:brightness-110"
            >
              Read yesterday's
            </button>
          ) : null}
        </Empty>
      ) : digest.error ? (
        <ErrorCard what="the digest" error={digest.error} onRetry={digest.refresh} />
      ) : (
        <Card className="md:p-10">
          <span className="sr-only" role="status">
            Loading the digest
          </span>
          <Skeleton lines={5} />
        </Card>
      )}

      <div className="mt-8">
        <HelpNote title="How is the digest written?">
          <p>
            At 9 pm Saathi gathers the day's facts: when the day started, which rooms were used, who rang the bell and
            any alerts. Amazon Bedrock turns them into 80–120 words and is told never to add anything that isn't in the
            data.
          </p>
          <p>If the AI isn't available, a plain template writes the same facts, so there's a note every evening.</p>
          <p>
            Press <strong>Listen</strong> to have your device read it aloud.
          </p>
        </HelpNote>
      </div>
    </>
  );
}

/** The digest as a letter: date, the text in a reading size, and Listen / Copy. */
function Letter({ label, text, writtenAt }: { label: string; text: string; writtenAt: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(
    () => () => {
      if (canSpeak()) window.speechSynthesis.cancel();
    },
    [],
  );

  function toggleSpeech() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${label}\n\n${text}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked (permissions or an insecure page): nothing to copy to
    }
  }

  const btn = "press inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold hover:bg-surface-2";
  return (
    <article className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl bg-surface px-6 py-8 shadow-lift md:px-14 md:py-12">
      <div className="flex flex-wrap items-center gap-3 border-b border-line pb-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-[0.14em] text-gold uppercase">Evening digest</p>
          <p className="display mt-1 text-2xl font-semibold">{label}</p>
        </div>
        <div className="flex gap-2">
          {canSpeak() ? (
            <button type="button" onClick={toggleSpeech} className={btn} aria-pressed={speaking}>
              {speaking ? <Square className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
              {speaking ? "Stop" : "Listen"}
            </button>
          ) : null}
          <button type="button" onClick={() => void copy()} className={btn}>
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      {/* Words appear as if being written (Aceternity text generate); screen readers get it whole. */}
      <p className="sr-only">{text}</p>
      <TextGenerate words={text} className="display mt-6 text-[21px] leading-[1.7] md:text-[23px]" aria-hidden />
      <p className="mt-8 flex items-center gap-2 text-sm text-muted">
        <PenLine className="size-4" aria-hidden="true" />
        Written by Saathi at {writtenAt}
      </p>
    </article>
  );
}
