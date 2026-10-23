import { useCallback, useEffect, useState } from "react";
import type { Api } from "./api";
import { POLL_MS, THANKS_MS } from "./config";
import { localHour, useNudgePolling, useParentName } from "./hooks";
import { dayPart, isLang, STRINGS, type Lang } from "./i18n";
import { IdleScreen } from "./screens/Idle";
import { type AckState, NudgeScreen } from "./screens/Nudge";
import { ThanksScreen } from "./screens/Thanks";
import { UnlockScreen } from "./screens/Unlock";
import { LANG_KEY, readSetting, writeSetting } from "./storage";
import { speak, useRepeatingVoice } from "./voice";

export function App({ api }: { api: Api }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = readSetting(LANG_KEY);
    return isLang(saved) ? saved : "en";
  });
  // Not remembered across reloads (M6): browsers only allow sound after a tap on *this* page
  // load, so the Unlock screen always comes back after a refresh.
  const [soundOn, setSoundOn] = useState(false);
  const [sending, setSending] = useState(false);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [ackedId, setAckedId] = useState<string | null>(null);
  const [thanking, setThanking] = useState(false);

  const name = useParentName(api);
  const nudge = useNudgePolling(api, POLL_MS);
  const t = STRINGS[lang];

  // A nudge is showing while the backend says so, unless we just answered this alert.
  const alertId = nudge?.active ? nudge.alert_id : null;
  const nudging = alertId !== null && alertId !== ackedId && !thanking;
  const ackState: AckState = sending ? "sending" : failedId === alertId ? "failed" : "ready";

  // English: the backend's own words (same greeting and clock as the Polly clip, L3).
  // Hindi: our translation spoken by the browser, because the clip is English (M5).
  const ownWords = `${t.greeting[dayPart(localHour(new Date()))]} ${name}. ${t.areYouOkay} ${t.pressGreen}`;
  const spoken = lang === "en" && nudge?.message ? nudge.message : ownWords;
  const audioUrl = lang === "en" ? (nudge?.audio_url ?? null) : null;
  const onBlocked = useCallback(() => setSoundOn(false), []);
  useRepeatingVoice(nudging, audioUrl, spoken, t.locale, onBlocked);

  useEffect(() => {
    if (!thanking) return;
    const id = window.setTimeout(() => setThanking(false), THANKS_MS);
    return () => window.clearTimeout(id);
  }, [thanking]);

  const chooseLang = (next: Lang) => {
    setLang(next);
    writeSetting(LANG_KEY, next);
  };

  const unlock = () => {
    setSoundOn(true);
    speak(t.soundOn, t.locale); // confirms sound works, and primes speech on Safari
  };

  const answer = async () => {
    if (!alertId) return;
    setSending(true);
    try {
      await api.ack(alertId, name || "parent");
      setAckedId(alertId);
      setFailedId(null);
      setThanking(true);
    } catch {
      setFailedId(alertId);
    } finally {
      setSending(false);
    }
  };

  let screen;
  if (thanking) screen = <ThanksScreen lang={lang} />;
  else if (nudging) screen = <NudgeScreen lang={lang} ackState={ackState} onOkay={answer} />;
  else if (!soundOn) screen = <UnlockScreen lang={lang} onUnlock={unlock} />;
  else screen = <IdleScreen lang={lang} name={name} />;

  return (
    <div
      lang={lang}
      className={`flex min-h-full flex-col ${thanking ? "bg-ok" : nudging ? "bg-alert" : ""}`}
    >
      <header className="flex justify-end p-4">
        <button
          type="button"
          onClick={() => chooseLang(lang === "en" ? "hi" : "en")}
          aria-label={t.switchToLabel}
          className="min-h-16 min-w-40 rounded-2xl border-4 border-ink bg-white px-6 text-[1.75rem] font-semibold text-ink focus-visible:outline-8 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {t.switchTo}
        </button>
      </header>
      {screen}
    </div>
  );
}
