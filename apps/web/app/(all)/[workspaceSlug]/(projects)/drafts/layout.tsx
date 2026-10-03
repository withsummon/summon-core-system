/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { Outlet, useOutletContext, useSearchParams } from "react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import type { WorkspaceSession } from "@/app/native-workspace";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { WorkspaceDraftHeader } from "./header";

export type WorkspaceDraftSession = WorkspaceSession & {
  createDraft: () => Promise<void>;
  creatingDraft: boolean;
  drafts: ReturnType<typeof usePaginatedQuery<typeof api.tasks.drafts.index.list>>;
};

export default function WorkspaceDraftLayout() {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const [params, setParams] = useSearchParams();
  const drafts = usePaginatedQuery(
    api.tasks.drafts.index.list,
    {
      workspaceId: session.workspace._id,
      deleted: params.get("draftView") === "trash",
    },
    { initialNumItems: 50 }
  );
  const { status, loadMore } = drafts;
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(50);
  }, [status, loadMore]);
  const create = useMutation(api.tasks.drafts.index.create);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [error, setError] = useState("");
  const completion = useRef(false);
  const leave = useCallback(() => {
    completion.current = false;
  }, []);
  const release = useReloadConfirmations(
    creatingDraft,
    "Your private draft is still being created.",
    leave,
    creatingDraft
  );
  const createDraft = async () => {
    if (creatingDraft) return;
    completion.current = true;
    setCreatingDraft(true);
    setError("");
    try {
      const draftId = await create({ workspaceId: session.workspace._id });
      release((allow) => {
        if (allow && completion.current) setParams({ draft: draftId });
        completion.current = false;
      });
    } catch (failure) {
      if (completion.current) setError(mutationMessage(failure));
      completion.current = false;
    } finally {
      setCreatingDraft(false);
    }
  };
  const context = { ...session, createDraft, creatingDraft, drafts };
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <AppHeader rowClassName="h-auto min-h-11" header={<WorkspaceDraftHeader session={context} />} />
      <ContentWrapper>
        {error && (
          <p role="alert" className="px-6 py-3 text-13 text-danger-primary">
            {error}
          </p>
        )}
        <Outlet context={context} />
      </ContentWrapper>
    </PreservedWorkspaceShell>
  );
}
