import { useEffect, useRef } from "react";
import { REPEAT_VOICE_MS } from "./config";

/** Speak `text` with the browser's own voice (used when the backend sends no audio). */
export function speak(text: string, locale: string): void {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/**
 * While `active`, play the nudge now and again every 30 s until it stops being active.
 * Plays `audioUrl` (Polly) when given, otherwise speaks `fallbackText`. `onBlocked` fires
 * if the browser refuses to play sound (no tap on this page yet).
 */
export function useRepeatingVoice(
  active: boolean,
  audioUrl: string | null,
  fallbackText: string,
  locale: string,
  onBlocked: () => void,
): void {
  const latest = useRef({ fallbackText, locale, onBlocked });
  latest.current = { fallbackText, locale, onBlocked };

  useEffect(() => {
    if (!active) return;
    let audio: HTMLAudioElement | null = null;
    const playOnce = () => {
      const { fallbackText: text, locale: lang, onBlocked: blocked } = latest.current;
      if (!audioUrl) {
        speak(text, lang);
        return;
      }
      audio?.pause();
      audio = new Audio(audioUrl);
      audio.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "NotAllowedError") blocked();
        else speak(text, lang); // audio failed to load: still say something
      });
    };
    playOnce();
    const id = window.setInterval(playOnce, REPEAT_VOICE_MS);
    return () => {
      window.clearInterval(id);
      audio?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [active, audioUrl]);
}
