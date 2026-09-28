/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext, useCallback, useContext, useEffect, useId, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useBeforeUnload, useBlocker } from "react-router";
import { AlertModalCore } from "@plane/ui";

type Confirmations = Map<string, Parameters<typeof useReloadConfirmations>>;
const ConfirmationContext = createContext<Dispatch<SetStateAction<Confirmations>> | null>(null);

/** React Router supports one blocker; the root composes all active editor and selection policies. */
export function ReloadConfirmations({ children }: { children: ReactNode }) {
  const [confirmations, setConfirmations] = useState<Confirmations>(() => new Map());
  const blocker = useBlocker(confirmations.size > 0);
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
    if (blocker.state === "blocked" && confirmations.size === 0) blocker.proceed();
  }, [blocker, confirmations.size]);
  return (
    <ConfirmationContext.Provider value={setConfirmations}>
      {children}
      {blocker.state === "blocked" && (
        <AlertModalCore
          isSubmitting={false}
          isOpen
          handleClose={() => blocker.reset()}
          handleSubmit={() => {
            confirmations.forEach(([, , onLeave]) => onLeave?.());
            blocker.proceed();
          }}
          variant="primary"
          title="Leave this page?"
          content={[...new Set([...confirmations.values()].map(([, message]) => message))].join(" ")}
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
  const setConfirmations = useContext(ConfirmationContext);
  if (!setConfirmations) throw new Error("Reload confirmation requires the root navigation owner.");
  useEffect(() => {
    if (!active) return;
    setConfirmations((current) => new Map(current).set(id, [active, message, onLeave]));
    return () => {
      setConfirmations((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
    };
  }, [active, id, message, onLeave, setConfirmations]);
}
