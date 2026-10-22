export type Lang = "en" | "hi";
export type DayPart = "morning" | "afternoon" | "evening";

interface Strings {
  greeting: Record<DayPart, string>;
  unlock: string;
  unlockHint: string;
  soundOn: string;
  areYouOkay: string;
  pressGreen: string;
  imOkay: string;
  sending: string;
  sendFailed: string;
  thanks: string;
  switchTo: string;
  switchToLabel: string;
  locale: string;
}

/** Every on-screen string, in both languages. */
export const STRINGS: Record<Lang, Strings> = {
  en: {
    greeting: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
    unlock: "Tap to turn on Saathi",
    unlockHint: "So Saathi can speak to you",
    soundOn: "Saathi is on.",
    areYouOkay: "Are you okay?",
    pressGreen: "Please press the green button.",
    imOkay: "I'm okay",
    sending: "Sending…",
    sendFailed: "Could not send. Please press again.",
    thanks: "Thank you. Your family has been told you're okay.",
    switchTo: "हिन्दी",
    switchToLabel: "हिन्दी में बदलें",
    locale: "en-IN",
  },
  hi: {
    greeting: { morning: "सुप्रभात", afternoon: "नमस्कार", evening: "शुभ संध्या" },
    unlock: "साथी चालू करने के लिए छुएँ",
    unlockHint: "ताकि साथी आपसे बात कर सके",
    soundOn: "साथी चालू है।",
    areYouOkay: "क्या आप ठीक हैं?",
    pressGreen: "कृपया हरा बटन दबाएँ।",
    imOkay: "मैं ठीक हूँ",
    sending: "भेज रहे हैं…",
    sendFailed: "भेजा नहीं जा सका। कृपया फिर से दबाएँ।",
    thanks: "धन्यवाद। आपके परिवार को बता दिया गया है कि आप ठीक हैं।",
    switchTo: "English",
    switchToLabel: "Switch to English",
    locale: "hi-IN",
  },
};

/** Morning before 12:00, afternoon before 17:00, evening after. */
export function dayPart(hour: number): DayPart {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function isLang(value: string | null): value is Lang {
  return value === "en" || value === "hi";
}
