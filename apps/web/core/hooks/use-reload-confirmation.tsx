/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext, useCallback, useContext, useEffect, useId, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { useBeforeUnload, useBlocker } from "react-router";
import { AlertModalCore } from "@plane/ui";

type Confirmations = Map<string, Parameters<typeof useReloadConfirmations>>;
type AfterRelease = (allowDefaultNavigation: boolean) => void;
export const ConfirmationContext = createContext<
  ((id: string, confirmation?: Parameters<typeof useReloadConfirmations>, afterRelease?: AfterRelease) => void) | null
>(null);
const SubmittingContext = createContext(false);

export function useReloadSubmitting() {
  return useContext(SubmittingContext);
}

/** A pending write belongs to its promise, even if a reactive query removes its row. */
export function usePendingConfirmation(message: string) {
  const setConfirmation = useContext(ConfirmationContext);
  if (!setConfirmation) throw new Error("Reload confirmation requires the root navigation owner.");
  return useCallback(() => {
    const id = crypto.randomUUID();
    setConfirmation(id, [true, message, undefined, true]);
    return (afterRelease?: AfterRelease) => setConfirmation(id, undefined, afterRelease);
  }, [message, setConfirmation]);
}

/** React Router supports one blocker; the root composes all active editor and selection policies. */
export function ReloadConfirmations({ children }: { children: ReactNode }) {
  const [confirmations] = useState<Confirmations>(() => new Map());
  const completions = useRef<AfterRelease[]>([]);
  const [revision, publish] = useReducer((current) => current + 1, 0);
  const setConfirmation = useCallback(
    (id: string, confirmation?: Parameters<typeof useReloadConfirmations>, afterRelease?: AfterRelease) => {
      if (confirmation) confirmations.set(id, confirmation);
      else if (!confirmations.delete(id) && !afterRelease) return;
      if (afterRelease) completions.current.push(afterRelease);
      publish();
    },
    [confirmations]
  );
  const blocker = useBlocker(useCallback(() => confirmations.size > 0, [confirmations]));
  useBeforeUnload(
    useCallback(
      (event) => {
        if (confirmations.size === 0) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [confirmations]
    ),
    { capture: true }
  );
  useEffect(() => {
    const completed = completions.current;
    completions.current = [];
    completed.forEach((afterRelease) => afterRelease(blocker.state === "unblocked"));
    if (blocker.state === "blocked" && confirmations.size === 0) blocker.proceed();
  }, [blocker, confirmations, revision]);
  const activeConfirmations = [...confirmations.values()];
  const isSubmitting = activeConfirmations.some(([, , , pending]) => pending);
  return (
    <ConfirmationContext.Provider value={setConfirmation}>
      <SubmittingContext.Provider value={isSubmitting}>{children}</SubmittingContext.Provider>
      {blocker.state === "blocked" && (
        <AlertModalCore
          isSubmitting={isSubmitting}
          isOpen
          handleClose={() => blocker.reset()}
          handleSubmit={() => {
            const current = [...confirmations.values()];
            if (current.some(([, , , pending]) => pending)) return;
            flushSync(() => current.forEach(([, , onLeave]) => onLeave?.()));
            if (confirmations.size > 0) blocker.proceed();
          }}
          variant="primary"
          title="Leave this page?"
          content={[...new Set(activeConfirmations.map(([, message]) => message))].join(" ")}
          primaryButtonText={{ default: "Leave", loading: "Waiting…" }}
          secondaryButtonText="Stay"
        />
      )}
    </ConfirmationContext.Provider>
  );
}

export default function useReloadConfirmations(
  active: boolean,
  message = "Changes you made may not be saved.",
  onLeave?: () => void,
  isSubmitting = false
) {
  const id = useId();
  const setConfirmation = useContext(ConfirmationContext);
  if (!setConfirmation) throw new Error("Reload confirmation requires the root navigation owner.");
  const release = useCallback(
    (afterRelease?: AfterRelease) => setConfirmation(id, undefined, afterRelease),
    [id, setConfirmation]
  );
  useEffect(() => {
    if (!active && !isSubmitting) return;
    setConfirmation(id, [active, message, onLeave, isSubmitting]);
    return release;
  }, [active, id, message, onLeave, isSubmitting, setConfirmation, release]);
  return release;
}
