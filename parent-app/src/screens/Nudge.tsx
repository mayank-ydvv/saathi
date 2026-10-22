import { STRINGS, type Lang } from "../i18n";

export type AckState = "ready" | "sending" | "failed";

interface Props {
  lang: Lang;
  ackState: AckState;
  onOkay: () => void;
}

/** Full-screen "Are you okay?" with one huge green button. */
export function NudgeScreen({ lang, ackState, onOkay }: Props) {
  const t = STRINGS[lang];
  return (
    <main
      role="alertdialog"
      aria-labelledby="nudge-title"
      aria-describedby="nudge-hint"
      className="flex flex-1 flex-col items-center justify-center gap-8 bg-alert px-4 py-8 text-center"
    >
      <h1 id="nudge-title" className="text-[clamp(3rem,10vw,7rem)] leading-tight font-bold">
        {t.areYouOkay}
      </h1>
      <p id="nudge-hint" className="text-[clamp(2rem,6vw,3.5rem)]">
        {ackState === "failed" ? t.sendFailed : t.pressGreen}
      </p>
      <button
        type="button"
        onClick={onOkay}
        disabled={ackState === "sending"}
        className="min-h-[160px] w-full max-w-4xl rounded-3xl bg-ok px-6 py-8 text-[clamp(3rem,10vw,6rem)] font-bold text-white hover:bg-ok-hover focus-visible:outline-8 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-90"
      >
        {ackState === "sending" ? t.sending : t.imOkay}
      </button>
    </main>
  );
}
