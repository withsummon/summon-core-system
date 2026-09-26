/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "@plane/propel/dialog";
// hooks
import { useIssueDetails } from "@/hooks/store/use-issue-details";
// local imports
import { FullScreenPeekView } from "./full-screen-peek-view";
import { SidePeekView } from "./side-peek-view";

type TIssuePeekOverview = {
  anchor: string;
  peekId: string;
  handlePeekClose?: () => void;
};

export const IssuePeekOverview = observer(function IssuePeekOverview(props: TIssuePeekOverview) {
  const { anchor, peekId, handlePeekClose } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  // query params
  const board = searchParams.get("board") || undefined;
  const state = searchParams.get("state") || undefined;
  const priority = searchParams.get("priority") || undefined;
  const labels = searchParams.get("labels") || undefined;
  // store
  const { peekMode, setPeekId, getIssueById, fetchIssueDetails } = useIssueDetails();
  // derived values
  const issueDetails = peekId ? getIssueById(peekId.toString()) : undefined;
  // state
  const isSidePeekOpen = !!peekId && peekMode === "side";
  const isModalPeekOpen = !!peekId && (peekMode === "modal" || peekMode === "full");

  useEffect(() => {
    if (anchor && peekId) {
      fetchIssueDetails(anchor, peekId.toString());
    }
  }, [anchor, fetchIssueDetails, peekId]);

  const handleClose = () => {
    // if close logic is passed down, call that instead of the below logic
    if (handlePeekClose) {
      handlePeekClose();
      return;
    }

    setPeekId(null);
    let queryParams: any = {
      board,
    };
    if (priority && priority.length > 0) queryParams = { ...queryParams, priority: priority };
    if (state && state.length > 0) queryParams = { ...queryParams, state: state };
    if (labels && labels.length > 0) queryParams = { ...queryParams, labels: labels };
    queryParams = new URLSearchParams(queryParams).toString();
    router.push(`/issues/${anchor}?${queryParams}`);
  };

  return (
    <>
      <Dialog
        open={isSidePeekOpen}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <Dialog.Panel
          aria-label="Work item details"
          className="top-0 right-0 left-auto h-full max-h-none w-full translate-x-0 translate-y-0 rounded-none sm:w-1/2 sm:max-w-none"
        >
          <SidePeekView anchor={anchor} handleClose={handleClose} issueDetails={issueDetails} />
        </Dialog.Panel>
      </Dialog>
      <Dialog
        open={isModalPeekOpen}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <Dialog.Panel
          aria-label="Work item details"
          className={peekMode === "modal" ? "h-[70%] w-[95%] sm:w-3/5 sm:max-w-none" : "size-[95%] sm:max-w-none"}
        >
          {peekMode === "modal" && (
            <SidePeekView anchor={anchor} handleClose={handleClose} issueDetails={issueDetails} />
          )}
          {peekMode === "full" && (
            <FullScreenPeekView anchor={anchor} handleClose={handleClose} issueDetails={issueDetails} />
          )}
        </Dialog.Panel>
      </Dialog>
    </>
  );
});
