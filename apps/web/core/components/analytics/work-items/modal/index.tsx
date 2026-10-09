/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { Dialog } from "@plane/propel/dialog";
import type { AnalyticsScope } from "../../analytics-wrapper";
import { WorkItemsModalMainContent } from "./content";
import { WorkItemsModalHeader } from "./header";
export function WorkItemsModal({
  isOpen,
  onClose,
  scope,
  title,
  workspaceSlug,
}: {
  isOpen: boolean;
  onClose: () => void;
  scope: AnalyticsScope;
  title: string;
  workspaceSlug: string;
}) {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const refresh = () => setGeneration((current) => current + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [isOpen]);
  const [fullScreen, setFullScreen] = useState(false);
  const close = () => {
    setFullScreen(false);
    onClose();
  };
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Panel
        className={`fixed top-0 right-0 left-auto flex h-dvh max-h-dvh w-full translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-subtle bg-surface-1 text-left sm:max-w-none ${fullScreen ? "sm:w-full" : "border-l sm:w-3/4"}`}
      >
        <WorkItemsModalHeader
          title={title}
          fullScreen={fullScreen}
          handleClose={close}
          setFullScreen={setFullScreen}
          onRefresh={() => setGeneration((current) => current + 1)}
        />
        {isOpen && (
          <WorkItemsModalMainContent
            scope={scope}
            generation={generation}
            workspaceSlug={workspaceSlug}
            fullScreen={fullScreen}
          />
        )}
      </Dialog.Panel>
    </Dialog>
  );
}
