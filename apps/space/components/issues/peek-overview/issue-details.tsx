/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { usePublish } from "@/hooks/store/publish";
import { IssueReactions } from "./issue-reaction";

export function PeekOverviewIssueDetails({
  anchor,
  issueDetails,
}: {
  anchor: string;
  issueDetails: FunctionReturnType<typeof api.publicSharing.index.getTask>;
}) {
  const publication = usePublish(anchor);
  return (
    <div className="space-y-2">
      <h6 className="text-14 font-medium text-placeholder">
        {publication?.project.identifier}-{issueDetails.sequence}
      </h6>
      <h4 className="text-20 font-medium break-words">{issueDetails.title}</h4>
      {issueDetails.descriptionHtml && issueDetails.descriptionHtml !== "<p></p>" && (
        <RichTextEditor
          editable={false}
          anchor={anchor}
          id={issueDetails._id}
          initialValue={issueDetails.descriptionHtml}
          target={{ anchor, taskId: issueDetails._id }}
        />
      )}
      <IssueReactions anchor={anchor} taskId={issueDetails._id} />
    </div>
  );
}
