/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";

export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      window.addEventListener(`local-storage:${key}`, onStoreChange);
      return () => window.removeEventListener(`local-storage:${key}`, onStoreChange);
    },
    [key]
  );
  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }, [key]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);
  // The legacy generic result is unvalidated. Schema-sensitive callers use unknown.
  const storedValue = useMemo<T | null | undefined>(() => {
    if (snapshot === null) return undefined;
    try {
      return JSON.parse(snapshot);
    } catch (_error) {
      return undefined;
    }
  }, [snapshot]);

  const setValue = useCallback(
    (value: T) => {
      window.localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new Event(`local-storage:${key}`));
    },
    [key]
  );

  const clearValue = useCallback(() => {
    window.localStorage.removeItem(key);
    window.dispatchEvent(new Event(`local-storage:${key}`));
  }, [key]);
  return {
    storedValue: storedValue === undefined ? initialValue : storedValue,
    setValue,
    clearValue,
    rawValue: snapshot,
  } as const;
};
