/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { getRandomLabelColor } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Loader } from "@plane/ui";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { CreateUpdateLabelInline } from "./create-update-label-inline";
import type { ProjectLabel } from "./create-update-label-inline";
import { DeleteLabelModal } from "./delete-label-modal";
import { ProjectSettingLabelGroup } from "./project-setting-label-group";
import { ProjectSettingLabelItem } from "./project-setting-label-item";
import { SettingsHeading } from "../settings/heading";

export function ProjectSettingsLabelList({
  projectId,
  settings,
}: {
  projectId: Id<"projects">;
  settings: FunctionReturnType<typeof api.tasks.labels.settings> | undefined;
}) {
  const { t } = useTranslation();
  const canManage = settings?.canManage === true;
  const [editor, setEditor] = useState<FunctionArgs<typeof api.tasks.labels.save> | null>(null);
  const [error, setError] = useState("");
  const [deletion, setDeletion] = useState<ProjectLabel | null>(null);
  const [pending, setPending] = useState(false);
  const save = useMutation(api.tasks.labels.save);
  const scrollable = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollable.current) return autoScrollForElements({ element: scrollable.current });
  }, []);
  const release = useReloadConfirmations(
    Boolean(editor) || pending,
    "Label changes may not be saved.",
    () => setEditor(null),
    pending
  );
  const command = async (args: FunctionArgs<typeof api.tasks.labels.save>) => {
    if (pending || !canManage) return false;
    setPending(true);
    setError("");
    try {
      await save(args);
      return true;
    } catch (failure) {
      const message = mutationMessage(failure);
      setError(message);
      setToast({ type: TOAST_TYPE.ERROR, title: "Unable to update label", message });
      return false;
    } finally {
      setPending(false);
    }
  };
  const closeEditor = () => {
    if (!pending) {
      release();
      setEditor(null);
      setError("");
    }
  };
  const edit = (label?: ProjectLabel) => {
    setError("");
    setEditor({
      projectId,
      labelId: label?._id,
      expectedRevision: label?.revision,
      change: {
        kind: "metadata",
        data: {
          name: label?.name ?? "",
          color: label?.color ?? getRandomLabelColor(),
          description: label?.description ?? "",
        },
      },
    });
  };
  const form = editor?.change.kind === "metadata" && (
    <CreateUpdateLabelInline
      data={editor.change.data}
      isUpdating={Boolean(editor.labelId)}
      canManage={canManage}
      pending={pending}
      error={error}
      onClose={closeEditor}
      onChange={(data) => setEditor({ ...editor, change: { kind: "metadata", data } })}
      onSubmit={async () => {
        if (editor && (await command(editor))) {
          release();
          setEditor(null);
        }
      }}
    />
  );
  const labels = settings?.labels;
  const roots = labels?.filter((label) => label.parentId === null);
  return (
    <>
      {deletion && <DeleteLabelModal label={deletion} canManage={canManage} onClose={() => setDeletion(null)} />}
      <SettingsHeading
        title={t("project_settings.labels.heading")}
        description={t("project_settings.labels.description")}
        control={
          canManage && (
            <Button variant="primary" size="lg" disabled={pending || Boolean(editor)} onClick={() => edit()}>
              {t("common.add_label")}
            </Button>
          )
        }
      />
      <div ref={scrollable} className="mt-6 w-full">
        {editor && (!editor.labelId || !labels?.some((row) => row._id === editor.labelId)) && (
          <div className="my-2 w-full rounded-sm border border-subtle px-3.5 py-2">{form}</div>
        )}
        {labels === undefined ? (
          <Loader className="space-y-5">
            <Loader.Item height="42px" />
            <Loader.Item height="42px" />
          </Loader>
        ) : labels.length === 0 && !editor ? (
          <EmptyStateCompact
            assetKey="label"
            assetClassName="size-20"
            title={t("settings_empty_state.labels.title")}
            description={t("settings_empty_state.labels.description")}
            actions={canManage ? [{ label: t("settings_empty_state.labels.cta_primary"), onClick: () => edit() }] : []}
            align="start"
            rootClassName="py-20"
          />
        ) : (
          roots?.map((label, index) => {
            const props = {
              label,
              labels,
              canManage: canManage && !pending && !editor,
              handleLabelDelete: setDeletion,
              isChild: false,
              isLastChild: index === roots.length - 1,
              onDrop: async (args: FunctionArgs<typeof api.tasks.labels.save>) => {
                await command(args);
              },
              onEdit: edit,
              editingLabelId: editor?.labelId,
              editor: form,
            };
            return labels.some((row) => row.parentId === label._id) ? (
              <ProjectSettingLabelGroup key={label._id} {...props} />
            ) : (
              <ProjectSettingLabelItem key={label._id} {...props} />
            );
          })
        )}
      </div>
    </>
  );
}
