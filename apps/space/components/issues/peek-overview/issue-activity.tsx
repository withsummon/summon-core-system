/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Link, useLocation } from "react-router";
import { Lock } from "lucide-react";
import { Button } from "@plane/propel/button";
import { AddComment } from "./comment/add-comment";
import { CommentCard } from "./comment/comment-detail-card";
import { useUser } from "@/hooks/store/use-user";
import useIsInIframe from "@/hooks/use-is-in-iframe";

export function PeekOverviewIssueActivity({
  anchor,
  issueDetails,
}: {
  anchor: string;
  issueDetails: FunctionReturnType<typeof api.publicSharing.index.getTask>;
}) {
  const location = useLocation();
  const { profile: currentUser, isInitializing } = useUser();
  const comments = usePaginatedQuery(
    api.tasks.comments.publicList,
    { anchor, taskId: issueDetails._id },
    { initialNumItems: 50 }
  );
  const isInIframe = useIsInIframe();
  return (
    <div className="pb-10">
      <h4 className="font-medium">Comments</h4>
      <div className="mt-4">
        <div className="space-y-4">
          {comments.results.map((comment) => (
            <CommentCard key={comment._id} anchor={anchor} comment={comment} />
          ))}
        </div>
        {comments.status === "LoadingFirstPage" && <p role="status">Loading comments…</p>}
        {(comments.status === "CanLoadMore" || comments.status === "LoadingMore") && (
          <Button className="mt-4" disabled={comments.status === "LoadingMore"} onClick={() => comments.loadMore(50)}>
            Load more comments
          </Button>
        )}
        {!isInIframe &&
          !isInitializing &&
          (currentUser ? (
            <div className="mt-4">
              <AddComment anchor={anchor} taskId={issueDetails._id} />
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-sm border border-strong bg-layer-2 px-2 py-2.5">
              <p className="flex items-center gap-2 text-13 text-secondary">
                <Lock className="size-3 shrink-0" />
                Sign in to add your comment
              </p>
              <Link to={`/?${new URLSearchParams({ next_path: location.pathname + location.search })}`}>
                <Button variant="primary">Sign in</Button>
              </Link>
            </div>
          ))}
      </div>
    </div>
  );
}
