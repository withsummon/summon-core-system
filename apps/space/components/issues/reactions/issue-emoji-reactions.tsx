/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { useLocation, useNavigate } from "react-router";
import { stringToEmoji } from "@plane/propel/emoji-icon-picker";
import { EmojiReactionGroup, EmojiReactionPicker } from "@plane/propel/emoji-reaction";
import { AddReactionIcon } from "@plane/propel/icons";
import { getIconButtonStyling } from "@plane/propel/icon-button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { groupReactions } from "@/helpers/emoji.helper";
import { useUser } from "@/hooks/store/use-user";
import useIsInIframe from "@/hooks/use-is-in-iframe";

export function IssueEmojiReactions({
  anchor,
  taskId,
}: Omit<FunctionArgs<typeof api.tasks.reactions.publicList>, "paginationOpts">) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const { profile: user } = useUser();
  const isInIframe = useIsInIframe();
  const navigate = useNavigate();
  const location = useLocation();
  const setReaction = useMutation(api.tasks.reactions.publicSet);
  const { results, status, loadMore } = usePaginatedQuery(
    api.tasks.reactions.publicList,
    { anchor, taskId },
    { initialNumItems: 50 }
  );
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(50);
  }, [status, loadMore]);
  const reactions = useMemo(
    () =>
      [...groupReactions(results)].map(([reaction, rows]) => ({
        emoji: stringToEmoji(reaction),
        count: rows.length,
        reacted: rows.some((row) => row.actorId === user?.id),
        users: rows.flatMap((row) => (row.actorName === null ? [] : [row.actorName])),
      })),
    [results, user?.id]
  );
  const choose = async (reaction: string) => {
    if (isInIframe || pending || status !== "Exhausted") return;
    if (!user) {
      navigate(`/?${new URLSearchParams({ next_path: location.pathname + location.search })}`);
      return;
    }
    setPending(true);
    try {
      await setReaction({
        anchor,
        taskId,
        reaction,
        active: !results.some((row) => row.actorId === user.id && row.reaction === reaction),
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Reaction could not be saved",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "Exhausted" ? (
        <>
          <EmojiReactionGroup
            className="contents"
            reactions={reactions}
            onReactionClick={(emoji) =>
              choose(
                Array.from(emoji)
                  .map((char) => char.codePointAt(0))
                  .join("-")
              )
            }
            showAddButton={false}
            disabled={pending || isInIframe}
          />
          {!isInIframe && (
            <EmojiReactionPicker
              isOpen={isPickerOpen && !pending}
              handleToggle={setIsPickerOpen}
              disabled={pending}
              onChange={choose}
              placement="bottom-start"
              label={<AddReactionIcon className="size-3.5" aria-hidden="true" />}
              buttonClassName={getIconButtonStyling("ghost", "sm")}
            />
          )}
        </>
      ) : (
        <span role="status" className="text-11 text-secondary">
          Loading reactions…
        </span>
      )}
    </div>
  );
}
