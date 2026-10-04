/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { GroupList } from "./group-list";
import { ProjectStateLoader } from "./loader";
import { StateDelete } from "./options/delete";

export type ProjectState = FunctionReturnType<typeof api.tasks.states.list>[number];
type SaveArgs = FunctionArgs<typeof api.tasks.states.save>;
export function ProjectStateRoot({
  project,
}: {
  project: Pick<FunctionReturnType<typeof api.projects.features.resolve>, "projectId" | "revision" | "canConfigure">;
}) {
  const states = useQuery(api.tasks.states.list, { projectId: project.projectId });
  const save = useMutation(api.tasks.states.save);
  const remove = useMutation(api.tasks.states.remove);
  const markDefault = useMutation(api.tasks.states.markDefault);
  const reorder = useMutation(api.tasks.states.reorder);
  const [editor, setEditor] = useState<SaveArgs | null>(null);
  const [deletion, setDeletion] = useState<{
    state: ProjectState;
    args: FunctionArgs<typeof api.tasks.states.remove>;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const disabled = pending || !project.canConfigure;
  useReloadConfirmations(Boolean(editor) || pending, "State changes may not be saved.", () => setEditor(null), pending);
  const command = async (operation: () => Promise<unknown>) => {
    if (disabled) return false;
    setPending(true);
    setError("");
    try {
      await operation();
      return true;
    } catch (failure) {
      const message = mutationMessage(failure);
      setError(message);
      setToast({ type: TOAST_TYPE.ERROR, title: "Unable to update project states", message });
      return false;
    } finally {
      setPending(false);
    }
  };
  const edit = (state: ProjectState) => {
    setError("");
    setEditor({
      projectId: project.projectId,
      expectedRevision: project.revision,
      stateId: state._id,
      data: { name: state.name, description: state.description, color: state.color, status: state.status },
    });
  };
  const submit = async () => {
    if (!editor) return;
    if (await command(() => save(editor))) setEditor(null);
  };
  return (
    <>
      {deletion && (
        <StateDelete
          state={deletion.state}
          pending={pending}
          disabled={disabled}
          error={error}
          onClose={() => {
            if (!pending) {
              setDeletion(null);
              setError("");
            }
          }}
          onSubmit={async () => {
            if (await command(() => remove(deletion.args))) setDeletion(null);
          }}
        />
      )}
      {states === undefined ? (
        <ProjectStateLoader />
      ) : (
        <GroupList
          states={states}
          disabled={disabled}
          pending={pending}
          editor={editor}
          error={error}
          onChange={(data) => setEditor((current) => current && { ...current, data })}
          onSubmit={submit}
          onCancel={() => {
            setEditor(null);
            setError("");
          }}
          onCreate={(status, color) => {
            setError("");
            setEditor({
              projectId: project.projectId,
              expectedRevision: project.revision,
              data: { name: "", description: "", color, status },
            });
          }}
          onEdit={edit}
          onDelete={(state) => {
            setError("");
            setDeletion({ state, args: { stateId: state._id, expectedRevision: project.revision } });
          }}
          onDefault={(stateId) =>
            command(() => markDefault({ projectId: project.projectId, stateId, expectedRevision: project.revision }))
          }
          onReorder={(args) =>
            command(() => reorder({ ...args, projectId: project.projectId, expectedRevision: project.revision }))
          }
        />
      )}
    </>
  );
}
