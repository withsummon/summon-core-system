/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect } from "react";
import type { TNameDescriptionLoader } from "@plane/types";
// hooks
import { useProjectInbox } from "@/hooks/store/use-project-inbox";
import { useAppRouter } from "@/hooks/use-app-router";

type TUseInboxIssueNavigation = {
  workspaceSlug: string;
  projectId: string;
  currentInboxIssueId: string | undefined;
  isNotificationEmbed: boolean;
  isSubmitting: TNameDescriptionLoader;
};

/**
 * Moving between intake work items: the arrow-key / chevron navigation, plus picking and
 * opening the neighbour to show once the current item leaves the list (accept, decline, snooze).
 */
export function useInboxIssueNavigation(params: TUseInboxIssueNavigation) {
  const { workspaceSlug, projectId, currentInboxIssueId, isNotificationEmbed, isSubmitting } = params;
  const { currentTab, filteredInboxIssueIds } = useProjectInbox();
  const router = useAppRouter();

  /** The next item, else the previous one, else nothing. */
  const getAdjacentIssueId = (): string | undefined => {
    const currentIssueIndex = filteredInboxIssueIds.findIndex((id) => id === currentInboxIssueId);
    return filteredInboxIssueIds[currentIssueIndex + 1] || filteredInboxIssueIds[currentIssueIndex - 1] || undefined;
  };

  const redirectToIssue = (nextOrPreviousIssueId: string | undefined) => {
    if (isNotificationEmbed) return;
    if (nextOrPreviousIssueId)
      router.push(
        `/${workspaceSlug}/projects/${projectId}/intake?currentTab=${currentTab}&inboxIssueId=${nextOrPreviousIssueId}`
      );
    else router.push(`/${workspaceSlug}/projects/${projectId}/intake?currentTab=${currentTab}`);
  };

  const currentIssueIndex = filteredInboxIssueIds.findIndex((issueId) => issueId === currentInboxIssueId) ?? 0;

  const handleInboxIssueNavigation = useCallback(
    (direction: "next" | "prev") => {
      if (!filteredInboxIssueIds || !currentInboxIssueId) return;
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (activeElement.classList.contains("tiptap") || activeElement.id === "title-input")) return;
      const nextIssueIndex =
        direction === "next"
          ? (currentIssueIndex + 1) % filteredInboxIssueIds.length
          : (currentIssueIndex - 1 + filteredInboxIssueIds.length) % filteredInboxIssueIds.length;
      const nextIssueId = filteredInboxIssueIds[nextIssueIndex];
      if (!nextIssueId) return;
      router.push(`/${workspaceSlug}/projects/${projectId}/intake?inboxIssueId=${nextIssueId}`);
    },
    [currentInboxIssueId, currentIssueIndex, filteredInboxIssueIds, projectId, router, workspaceSlug]
  );

  useEffect(() => {
    if (isSubmitting === "submitting" || isNotificationEmbed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") handleInboxIssueNavigation("prev");
      else if (e.key === "ArrowDown") handleInboxIssueNavigation("next");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleInboxIssueNavigation, isNotificationEmbed, isSubmitting]);

  return { getAdjacentIssueId, redirectToIssue, handleInboxIssueNavigation };
}
