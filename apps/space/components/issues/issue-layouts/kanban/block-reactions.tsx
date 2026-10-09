/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { useParams } from "next/navigation";
// plane utils
import { cn } from "@plane/utils";
// components
import { IssueEmojiReactions } from "@/components/issues/reactions/issue-emoji-reactions";
import { IssueVotes } from "@/components/issues/reactions/issue-vote-reactions";
// hooks
import { usePublish } from "@/hooks/store/publish";

type Props = {
  taskId: ComponentProps<typeof IssueVotes>["taskId"];
};
export function BlockReactions(props: Props) {
  const { taskId } = props;
  const { anchor } = useParams();
  const publication = usePublish(anchor?.toString() ?? "");
  const canVote = publication?.settings.votesEnabled;
  const canReact = publication?.settings.reactionsEnabled;

  // if the user cannot vote or react then return empty
  if (!canVote && !canReact) return <></>;

  return (
    <div className="flex w-full flex-wrap rounded-b-lg border-t-[1px] border-t-subtle-1 bg-surface-2 outline-transparent">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        {canVote && (
          <div
            className={cn(`flex items-center gap-2 pr-1`, {
              "after:ml-1 after:h-6 after:w-[1px] after:bg-layer-3": canReact,
            })}
          >
            <IssueVotes anchor={anchor?.toString() ?? ""} taskId={taskId} size="sm" />
          </div>
        )}
        {canReact && (
          <div className="flex flex-wrap items-center gap-2">
            <IssueEmojiReactions anchor={anchor?.toString() ?? ""} taskId={taskId} />
          </div>
        )}
      </div>
    </div>
  );
}
