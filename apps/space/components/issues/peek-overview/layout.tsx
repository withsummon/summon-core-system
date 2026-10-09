/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ComponentProps } from "react";
import { useSearchParams } from "react-router";
import { Dialog } from "@plane/propel/dialog";
import { useIssueDetails } from "@/hooks/store/use-issue-details";
import { PeekOverviewHeader } from "./header";
import { FullScreenPeekView } from "./full-screen-peek-view";
import { SidePeekView } from "./side-peek-view";

export function IssuePeekOverview({ anchor, peekId }: { anchor: string; peekId: string }) {
  const [params, setParams] = useSearchParams();
  const [peekMode, setPeekMode] = useState<ComponentProps<typeof PeekOverviewHeader>["peekMode"]>("side");
  const issueDetails = useIssueDetails(anchor, peekId);
  const handleClose = () => {
    const next = new URLSearchParams(params);
    next.delete("peekId");
    setParams(next);
  };
  const View = peekMode === "full" ? FullScreenPeekView : SidePeekView;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Panel
        aria-label="Work item details"
        className={
          peekMode === "side"
            ? "top-0 right-0 left-auto h-full max-h-none w-full translate-x-0 translate-y-0 rounded-none sm:w-1/2 sm:max-w-none"
            : peekMode === "modal"
              ? "h-[70%] w-[95%] sm:w-3/5 sm:max-w-none"
              : "size-[95%] sm:max-w-none"
        }
      >
        <View
          anchor={anchor}
          handleClose={handleClose}
          issueDetails={issueDetails}
          peekMode={peekMode}
          setPeekMode={setPeekMode}
        />
      </Dialog.Panel>
    </Dialog>
  );
}
