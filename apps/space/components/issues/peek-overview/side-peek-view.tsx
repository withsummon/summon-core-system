/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
// plane imports
import { Loader } from "@plane/ui";
// store hooks
import { usePublish } from "@/hooks/store/publish";
// types

// local imports
import { PeekOverviewHeader } from "./header";
import { PeekOverviewIssueActivity } from "./issue-activity";
import { PeekOverviewIssueDetails } from "./issue-details";
import { PeekOverviewIssueProperties } from "./issue-properties";

type Props = ComponentProps<typeof PeekOverviewHeader> & {
  anchor: string;
  handleClose: () => void;
  issueDetails: FunctionReturnType<typeof api.publicSharing.index.getTask> | undefined;
};

export function SidePeekView(props: Props) {
  const { anchor, issueDetails } = props;
  // store hooks
  const publication = usePublish(anchor);

  return (
    <div className="flex size-full flex-col overflow-hidden">
      <div className="w-full p-5">
        <PeekOverviewHeader {...props} />
      </div>
      {issueDetails ? (
        <div className="size-full overflow-y-auto px-6">
          {/* issue title and description */}
          <div className="w-full">
            <PeekOverviewIssueDetails anchor={anchor} issueDetails={issueDetails} />
          </div>
          {/* issue properties */}
          <div className="mt-6 w-full">
            <PeekOverviewIssueProperties issueDetails={issueDetails} />
          </div>
          {/* divider */}
          <div className="my-5 h-[1] w-full border-t border-subtle" />
          {/* issue activity/comments */}
          {publication?.settings.commentsEnabled && (
            <div className="w-full pb-5">
              <PeekOverviewIssueActivity anchor={anchor} issueDetails={issueDetails} />
            </div>
          )}
        </div>
      ) : (
        <Loader className="px-6">
          <Loader.Item height="30px" />
          <div className="mt-3 space-y-2">
            <Loader.Item height="20px" width="70%" />
            <Loader.Item height="20px" width="60%" />
            <Loader.Item height="20px" width="60%" />
          </div>
        </Loader>
      )}
    </div>
  );
}
