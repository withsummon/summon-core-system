/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useContext, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { Dialog } from "@plane/propel/dialog";
import { Button } from "@plane/propel/button";
import { AlertModalCore, ModalCore } from "@plane/ui";
import { NativeProjectCreateContext } from "@/app/native-workspace";
import type { WorkspaceDraftSession } from "@/app/(all)/[workspaceSlug]/(projects)/drafts/layout";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { LayoutErrorBoundary } from "@/components/common/layout-error-boundary";
import { DraftForm } from "@/components/convex-core/tasks/drafts/form";
import { DraftAttachments } from "@/components/convex-core/tasks/drafts/draft-attachments";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { DraftIssueBlock } from "./draft-issue-block";
import { WorkspaceDraftEmptyState } from "./empty-state";
import { WorkspaceDraftIssuesLoader } from "./loader";
import { WorkspaceDraftIssueDeleteIssueModal } from "./delete-modal";

export function WorkspaceDraftIssuesRoot({ session }: { session: WorkspaceDraftSession }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [action, setAction] = useState<Pick<
    ComponentProps<typeof WorkspaceDraftIssueDeleteIssueModal>,
    "draft" | "operation"
  > | null>(null);
  const projects = useQuery(api.projects.index.list, { workspaceId: session.workspace._id });
  const createProject = useContext(NativeProjectCreateContext);
  const deleted = params.get("draftView") === "trash";
  const selected = params.get("draft");
  const open = (draftId: string, move = false) => {
    setAction(null);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("draft", draftId);
      if (move) next.set("draftMove", "true");
      else next.delete("draftMove");
      return next;
    });
  };
  const close = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("draft");
      next.delete("draftMove");
      return next;
    });
  const { drafts } = session;
  return (
    <>
      {drafts.status === "LoadingFirstPage" || !projects ? (
        <WorkspaceDraftIssuesLoader items={14} />
      ) : !projects.length && !drafts.results.length ? (
        <EmptyStateDetailed
          title={t("workspace_projects.empty_state.no_projects.title")}
          description={t("workspace_projects.empty_state.no_projects.description")}
          assetKey="project"
          assetClassName="size-40"
          actions={
            createProject
              ? [
                  {
                    label: t("workspace_projects.empty_state.no_projects.primary_button.text"),
                    onClick: createProject,
                    variant: "primary",
                  },
                ]
              : []
          }
        />
      ) : !drafts.results.length ? (
        <WorkspaceDraftEmptyState
          deleted={deleted}
          disabled={session.creatingDraft || session.workspace.membershipRole === "guest"}
          onCreate={() => void session.createDraft()}
        />
      ) : (
        <div className="relative">
          {drafts.results.map((draft) => (
            <DraftIssueBlock
              key={draft._id}
              issue={draft}
              onEdit={() => open(draft._id)}
              onMove={() => open(draft._id, true)}
              onCopy={() => setAction({ draft, operation: "copy" })}
              onDelete={() => setAction({ draft, operation: "remove" })}
              onRestore={() => setAction({ draft, operation: "restore" })}
            />
          ))}
          {drafts.status === "CanLoadMore" && (
            <Button
              variant="ghost"
              className="h-11 w-full justify-start border-b border-subtle px-6 text-13 text-accent-primary"
              onClick={() => drafts.loadMore(50)}
            >
              Load More ↓
            </Button>
          )}
          {drafts.status === "LoadingMore" && <WorkspaceDraftIssuesLoader items={1} />}
        </div>
      )}
      {action && (
        <WorkspaceDraftIssueDeleteIssueModal
          key={`${action.draft._id}:${action.operation}`}
          {...action}
          onClose={() => setAction(null)}
          onCopy={open}
        />
      )}
      {selected && (
        <LayoutErrorBoundary key={selected}>
          <WorkspaceDraftEditorModal
            session={session}
            draftId={selected}
            move={params.get("draftMove") === "true"}
            onClose={close}
          />
        </LayoutErrorBoundary>
      )}
    </>
  );
}

function WorkspaceDraftEditorModal({
  session,
  draftId,
  move,
  onClose,
}: {
  session: WorkspaceDraftSession;
  draftId: string;
  move: boolean;
  onClose: () => void;
}) {
  const client = useConvex();
  const loading = useRef<Promise<FunctionReturnType<typeof api.tasks.drafts.index.resolve>> | null>(null);
  const [opened, setOpened] = useState<FunctionReturnType<typeof api.tasks.drafts.index.resolve> | null>(null);
  const [error, setError] = useState("");
  const [formState, setFormState] = useState({ dirty: false, busy: false });
  const [pendingAttachments, setPendingAttachments] = useState(false);
  const busy = formState.busy || pendingAttachments;
  useEffect(() => {
    let active = true;
    loading.current ??= client.query(api.tasks.drafts.index.resolve, { workspaceId: session.workspace._id, draftId });
    void loading.current.then(
      (draft) => {
        if (active) setOpened(draft);
        return draft;
      },
      (failure) => {
        if (active) setError(mutationMessage(failure));
      }
    );
    return () => {
      active = false;
    };
  }, [client, session.workspace._id, draftId]);
  const current = session.drafts.results.find((row) => row._id === opened?._id);
  const draft = current ?? opened;
  useReloadConfirmations(
    pendingAttachments,
    "Draft attachments are still uploading. Finish or cancel them before leaving.",
    onClose,
    pendingAttachments
  );
  const [discarding, setDiscarding] = useState(false);
  const close = () => {
    if (!busy) {
      if (formState.dirty) setDiscarding(true);
      else onClose();
    }
  };
  return (
    <>
      <ModalCore isOpen handleClose={close} className="max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <Dialog.Title className="sr-only">{move ? "Move draft to project" : "Edit draft"}</Dialog.Title>
          <div className="mb-3 flex justify-end">
            <Button variant="ghost" size="sm" disabled={busy} onClick={close}>
              Close
            </Button>
          </div>
          {opened && session.drafts.status === "Exhausted" && !current && (
            <p role="status" className="mb-3 text-13 text-secondary">
              This draft is no longer in the current view. Your opened edits remain here; saving checks the current
              draft and project access.
            </p>
          )}
          {error ? (
            <p role="alert" className="text-13 text-danger-primary">
              {error}
            </p>
          ) : draft ? (
            <WorkspaceDraftEditor
              session={session}
              draft={draft}
              move={move}
              onClose={onClose}
              onCancel={close}
              onStateChange={setFormState}
              pendingAttachments={pendingAttachments}
              onPendingAttachmentsChange={setPendingAttachments}
            />
          ) : (
            <p role="status" className="text-13 text-secondary">
              Opening draft…
            </p>
          )}
        </div>
      </ModalCore>
      {discarding && (
        <AlertModalCore
          isOpen
          isSubmitting={false}
          title="Discard unsaved edits?"
          content="Your unsaved changes will be lost. The saved private draft remains in your collection."
          variant="primary"
          handleClose={() => setDiscarding(false)}
          handleSubmit={onClose}
          primaryButtonText={{ default: "Discard edits", loading: "Discarding…" }}
          secondaryButtonText="Keep editing"
        />
      )}
    </>
  );
}

function WorkspaceDraftEditor({
  session,
  draft,
  move,
  onClose,
  onCancel,
  onStateChange,
  onPendingAttachmentsChange,
  pendingAttachments,
}: {
  session: WorkspaceDraftSession;
  draft: FunctionReturnType<typeof api.tasks.drafts.index.resolve>;
  move: boolean;
  onClose: () => void;
  onCancel: () => void;
  onStateChange: NonNullable<ComponentProps<typeof DraftForm>["onStateChange"]>;
  onPendingAttachmentsChange: (pending: boolean) => void;
  pendingAttachments: boolean;
}) {
  const publish = useMutation(api.tasks.drafts.index.publish);
  const navigate = useNavigate();
  const completion = useRef(onClose);
  return (
    <DraftForm
      initial={draft}
      onDone={() => completion.current()}
      onCancel={onCancel}
      onStateChange={onStateChange}
      attachmentsPending={pendingAttachments}
      submitLabel={move ? "Save and move to project" : undefined}
      onSaved={
        move
          ? async (receipt) => {
              const task = await publish({ draftId: draft._id, expectedUpdatedAt: receipt.updatedAt });
              completion.current = () =>
                navigate(`/${session.workspace.slug}/projects/${task.projectId}/issues/${task.taskId}/`);
            }
          : undefined
      }
    >
      <DraftAttachments draftId={draft._id} onPendingChange={onPendingAttachmentsChange} />
    </DraftForm>
  );
}
