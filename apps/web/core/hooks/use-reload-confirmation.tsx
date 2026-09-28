/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext, useCallback, useContext, useEffect, useId, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useBeforeUnload, useBlocker } from "react-router";
import { AlertModalCore } from "@plane/ui";

type Confirmations = Map<string, Parameters<typeof useReloadConfirmations>>;
type AfterRelease = (allowDefaultNavigation: boolean) => void;
const ConfirmationContext = createContext<
  ((id: string, confirmation?: Parameters<typeof useReloadConfirmations>, afterRelease?: AfterRelease) => void) | null
>(null);

/** React Router supports one blocker; the root composes all active editor and selection policies. */
export function ReloadConfirmations({ children }: { children: ReactNode }) {
  const [confirmations] = useState<Confirmations>(() => new Map());
  const completions = useRef<AfterRelease[]>([]);
  const [revision, publish] = useReducer((current) => current + 1, 0);
  const setConfirmation = useCallback(
    (id: string, confirmation?: Parameters<typeof useReloadConfirmations>, afterRelease?: AfterRelease) => {
      if (confirmation) confirmations.set(id, confirmation);
      else confirmations.delete(id);
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
  return (
    <ConfirmationContext.Provider value={setConfirmation}>
      {children}
      {blocker.state === "blocked" && (
        <AlertModalCore
          isSubmitting={false}
          isOpen
          handleClose={() => blocker.reset()}
          handleSubmit={() => {
            activeConfirmations.forEach(([, , onLeave]) => onLeave?.());
            blocker.proceed();
          }}
          variant="primary"
          title="Leave this page?"
          content={[...new Set(activeConfirmations.map(([, message]) => message))].join(" ")}
          primaryButtonText={{ default: "Leave", loading: "Leaving…" }}
          secondaryButtonText="Stay"
        />
      )}
    </ConfirmationContext.Provider>
  );
}

export default function useReloadConfirmations(
  active: boolean,
  message = "Changes you made may not be saved.",
  onLeave?: () => void
) {
  const id = useId();
  const setConfirmation = useContext(ConfirmationContext);
  if (!setConfirmation) throw new Error("Reload confirmation requires the root navigation owner.");
  const release = useCallback(
    (afterRelease?: AfterRelease) => setConfirmation(id, undefined, afterRelease),
    [id, setConfirmation]
  );
  useEffect(() => {
    if (!active) return;
    setConfirmation(id, [active, message, onLeave]);
    return release;
  }, [active, id, message, onLeave, setConfirmation, release]);
  return release;
}
