/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { SetStateAction } from "react";
import { useCallback, useState } from "react";

/**
 * State that reads as `initialValue` whenever `source` changes identity (e.g. a new list of items),
 * without a reset effect and its stale intermediate render.
 * `initialValue` should be referentially stable (a module constant or primitive).
 */
export const useStateResetOnChange = <TValue, TSource>(source: TSource, initialValue: TValue) => {
  const [state, setState] = useState({ source, value: initialValue });
  const value = Object.is(state.source, source) ? state.value : initialValue;

  const setValue = useCallback(
    (action: SetStateAction<TValue>) =>
      setState((prev) => {
        const prevValue = Object.is(prev.source, source) ? prev.value : initialValue;
        const nextValue = typeof action === "function" ? (action as (prev: TValue) => TValue)(prevValue) : action;
        return { source, value: nextValue };
      }),
    [source, initialValue]
  );

  return [value, setValue] as const;
};
