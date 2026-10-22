import type { StatusColour } from "../api/types";

export const MOCK_VARIANTS: readonly StatusColour[] = ["green", "yellow", "red"];

/**
 * Which status the mock backend acts out, from `?mock=green|yellow|red` (so each state can
 * be filmed). Anything else falls back to red: the demo's headline shot.
 */
export function mockVariant(search: string = window.location.search): StatusColour {
  const value = new URLSearchParams(search).get("mock");
  return MOCK_VARIANTS.find((v) => v === value) ?? "red";
}
