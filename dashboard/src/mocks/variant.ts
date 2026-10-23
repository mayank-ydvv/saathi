import type { StatusColour } from "../api/types";

export const MOCK_VARIANTS: readonly StatusColour[] = ["green", "yellow", "red"];

/**
 * Which status `?mock=green|yellow|red` asks for (so each state can be filmed). Anything else
 * falls back to red: the demo's headline shot.
 */
export function mockVariant(search: string = window.location.search): StatusColour {
  const value = new URLSearchParams(search).get("mock");
  return MOCK_VARIANTS.find((v) => v === value) ?? "red";
}

let chosen: StatusColour | null = null;

/** The header's demo switch picks a variant; it wins over the page URL until reset. */
export function setMockVariant(variant: StatusColour | null): void {
  chosen = variant;
}

/** The variant the mock backend plays now. */
export function activeMockVariant(): StatusColour {
  return chosen ?? mockVariant();
}
