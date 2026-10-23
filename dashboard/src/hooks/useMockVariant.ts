import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { StatusColour } from "../api/types";
import { mockVariant, setMockVariant } from "../mocks/variant";

/**
 * The mock status variant, kept in the URL (`?mock=green|yellow|red`) so a filmed state can be
 * linked to and survives a reload. Setting it replaces the history entry (no back-button noise).
 */
export function useMockVariant(): [StatusColour, (next: StatusColour) => void] {
  const [params, setParams] = useSearchParams();
  const variant = mockVariant(`?${params.toString()}`);
  const setVariant = useCallback(
    (next: StatusColour) => {
      setMockVariant(next); // the mock backend follows at once, whatever router is in use
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev);
          updated.set("mock", next);
          return updated;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [variant, setVariant];
}
