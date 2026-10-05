/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { useLocation, useNavigate } from "react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Tooltip } from "@plane/propel/tooltip";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { cn } from "@plane/utils";
import { useUser } from "@/hooks/store/use-user";
import useIsInIframe from "@/hooks/use-is-in-iframe";

export function IssueVotes({
  anchor,
  taskId,
  size = "md",
}: FunctionArgs<typeof api.tasks.votes.summary> & { size?: "md" | "sm" }) {
  const [pending, setPending] = useState(false);
  const { profile: user } = useUser();
  const isInIframe = useIsInIframe();
  const navigate = useNavigate();
  const location = useLocation();
  const summary = useQuery(api.tasks.votes.summary, { anchor, taskId });
  const viewer = useQuery(api.tasks.votes.viewer, user ? { anchor, taskId } : "skip");
  const up = usePaginatedQuery(api.tasks.votes.actors, { anchor, taskId, vote: 1 }, { initialNumItems: 50 });
  const down = usePaginatedQuery(api.tasks.votes.actors, { anchor, taskId, vote: -1 }, { initialNumItems: 50 });
  const { status: upStatus, loadMore: loadMoreUp } = up;
  useEffect(() => {
    if (upStatus === "CanLoadMore") loadMoreUp(50);
  }, [upStatus, loadMoreUp]);
  const { status: downStatus, loadMore: loadMoreDown } = down;
  useEffect(() => {
    if (downStatus === "CanLoadMore") loadMoreDown(50);
  }, [downStatus, loadMoreDown]);
  const setVote = useMutation(api.tasks.votes.set);
  const vote = async (choice: 1 | -1) => {
    if (pending || isInIframe) return;
    if (!user) {
      navigate(`/?${new URLSearchParams({ next_path: location.pathname + location.search })}`);
      return;
    }
    setPending(true);
    try {
      await setVote({ anchor, taskId, vote: viewer === choice ? null : choice });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Vote could not be saved",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      {([1, -1] satisfies (1 | -1)[]).map((choice) => {
        const actors = choice === 1 ? up : down;
        const count = choice === 1 ? summary?.upVotes : summary?.downVotes;
        const Icon = choice === 1 ? ArrowUp : ArrowDown;
        return (
          <Tooltip
            key={choice}
            tooltipContent={
              actors.status !== "Exhausted"
                ? "Loading voters…"
                : count === 0
                  ? `No ${choice === 1 ? "upvotes" : "downvotes"} yet`
                  : actors.results.flatMap((row) => (row.actorName === null ? [] : [row.actorName])).join(", ")
            }
          >
            <button
              type="button"
              aria-label={choice === 1 ? "Upvote work item" : "Downvote work item"}
              aria-pressed={viewer === choice}
              disabled={pending || isInIframe || summary === undefined || (!!user && viewer === undefined)}
              onClick={() => vote(choice)}
              className={cn(
                "flex items-center justify-center gap-x-1 overflow-hidden rounded-sm border hover:bg-layer-transparent-hover",
                size === "sm" ? "h-6 min-w-9 px-1" : "h-7 px-2",
                {
                  "border-accent-strong-200 text-accent-secondary": viewer === 1 && choice === 1,
                  "border-danger-strong text-danger-primary": viewer === -1 && choice === -1,
                  "border-strong": viewer !== choice,
                  "cursor-default": isInIframe,
                }
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="text-13 font-regular">{count ?? "…"}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
