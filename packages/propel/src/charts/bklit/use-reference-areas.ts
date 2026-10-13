"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { extractReferenceAreaConfigs, type ReferenceAreaConfig } from "./reference-area-config";

/**
 * Reference areas declared as chart children plus those nested components register at runtime.
 * Returns the merged list and the registration API for `ReferenceAreaRegistrationContext`.
 */
export function useReferenceAreas(children: ReactNode) {
  const [registered, setRegistered] = useState(() => new Map<string, ReferenceAreaConfig>());

  const registerReferenceArea = useCallback((id: string, config: ReferenceAreaConfig) => {
    setRegistered((prev) => {
      const existing = prev.get(id);
      if (
        existing &&
        existing.yAxisId === config.yAxisId &&
        existing.y1 === config.y1 &&
        existing.y2 === config.y2 &&
        existing.axisLabelColor === config.axisLabelColor
      ) {
        return prev;
      }
      const next = new Map(prev);
      next.set(id, config);
      return next;
    });
  }, []);

  const unregisterReferenceArea = useCallback((id: string) => {
    setRegistered((prev) => {
      if (!prev.has(id)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const registration = useMemo(
    () => ({ registerReferenceArea, unregisterReferenceArea }),
    [registerReferenceArea, unregisterReferenceArea]
  );

  const referenceAreas = useMemo(() => {
    const extracted = extractReferenceAreaConfigs(children);
    if (registered.size === 0) {
      return extracted;
    }
    const runtime = [...registered.values()];
    return extracted.length === 0 ? runtime : [...extracted, ...runtime];
  }, [children, registered]);

  return { referenceAreas, registration };
}
