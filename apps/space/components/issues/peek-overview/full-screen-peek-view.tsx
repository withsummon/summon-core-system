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

export function FullScreenPeekView(props: Props) {
  const { anchor, issueDetails } = props;
  const publication = usePublish(anchor);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto sm:grid sm:grid-cols-10 sm:divide-x sm:divide-subtle-1 sm:overflow-hidden">
      <div className="flex w-full shrink-0 flex-col sm:col-span-7 sm:h-full sm:overflow-hidden">
        <div className="w-full p-5">
          <PeekOverviewHeader {...props} />
        </div>
        {issueDetails ? (
          <div className="w-full px-6 sm:h-full sm:overflow-y-auto">
            {/* issue title and description */}
            <div className="w-full">
              <PeekOverviewIssueDetails anchor={anchor} issueDetails={issueDetails} />
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
      <div className="w-full shrink-0 border-t border-subtle-1 sm:col-span-3 sm:h-full sm:overflow-y-auto sm:border-t-0">
        {/* issue properties */}
        <div className="w-full px-6 py-5">
          {issueDetails ? (
            <PeekOverviewIssueProperties issueDetails={issueDetails} mode="full" />
          ) : (
            <Loader className="mt-11 space-y-4">
              <Loader.Item height="30px" />
              <Loader.Item height="30px" />
              <Loader.Item height="30px" />
              <Loader.Item height="30px" />
            </Loader>
          )}
        </div>
      </div>
    </div>
  );
}
