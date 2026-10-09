/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { IssueEmojiReactions } from "@/components/issues/reactions/issue-emoji-reactions";
import { IssueVotes } from "@/components/issues/reactions/issue-vote-reactions";
import { usePublish } from "@/hooks/store/publish";
import useIsInIframe from "@/hooks/use-is-in-iframe";

export function IssueReactions({ anchor, taskId }: ComponentProps<typeof IssueEmojiReactions>) {
  const publication = usePublish(anchor);
  const isInIframe = useIsInIframe();
  return (
    <div className="mt-4 flex items-center gap-3">
      {publication?.settings.votesEnabled && <IssueVotes anchor={anchor} taskId={taskId} />}
      {!isInIframe && publication?.settings.reactionsEnabled && <IssueEmojiReactions anchor={anchor} taskId={taskId} />}
    </div>
  );
}
