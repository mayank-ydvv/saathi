/** localStorage that never throws (private windows and blocked storage just forget). */
export function readSetting(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the setting lasts only for this visit.
  }
}

export const LANG_KEY = "saathi.lang";
/** No longer written (M6); kept so older tablets' stored value can be cleared. */
export const SOUND_KEY = "saathi.soundOn";
