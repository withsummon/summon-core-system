/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useEffect, useLayoutEffect, useState, useRef } from "react";
import { debounce } from "lodash-es";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi, TExtensions } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import type { EFileAssetType, TNameDescriptionLoader } from "@plane/types";
import { getDescriptionPlaceholderI18n } from "@plane/utils";
import { Button } from "@plane/propel/button";
// components
import { RichTextEditor } from "@/components/editor/rich-text";
// hooks
import { useEditorAsset } from "@/hooks/store/use-editor-asset";
import { useWorkspace } from "@/hooks/store/use-workspace";
// plane web services
import { WorkspaceService } from "@/services/workspace.service";
// local imports
import { TextAutosave } from "./autosave";
// services init
const workspaceService = new WorkspaceService();

type Props = {
  /**
   * @description Container class name, this will be used to add custom styles to the editor container
   */
  containerClassName?: string;
  /**
   * @description Disabled, this will be used to disable the editor
   */
  disabled?: boolean;
  /**
   * @description Disabled extensions, this will be used to disable the extensions in the editor
   */
  disabledExtensions?: TExtensions[];
  /**
   * @description Editor ref, this will be used to imperatively attach editor related helper functions
   */
  editorRef?: React.RefObject<EditorRefApi>;
  /**
   * @description Entity ID, this will be used for file uploads and as the unique identifier for the entity
   */
  entityId: string;
  /**
   * @description File asset type, this will be used to upload the file to the editor
   */
  fileAssetType: EFileAssetType;
  /**
   * @description Initial value, pass the actual description to initialize the editor
   */
  initialValue: string | undefined;
  /**
   * @description Submit handler, the actual function which will be called when the form is submitted
   */
  onSubmit: (html: string, isMigrationUpdate?: boolean) => Promise<string>;
  /**
   * @description Placeholder, if not provided, the placeholder will be the default placeholder
   */
  placeholder?: string | ((isFocused: boolean, value: string) => string);
  /**
   * @description projectId, if not provided, the entity will be considered as a workspace entity
   */
  projectId?: string;
  /**
   * @description Set is submitting, use it to set the loading state of the form
   */
  setIsSubmitting: (initialValue: TNameDescriptionLoader) => void;
  /**
   * @description SWR description, use it only if you want to sync changes in realtime(pseudo realtime)
   */
  swrDescription?: string | null | undefined;
  /**
   * @description Workspace slug, this will be used to get the workspace details
   */
  workspaceSlug: string;
  /**
   * @description Issue sequence id, this will be used to get the issue sequence id
   */
  issueSequenceId?: number;
};

/**
 * @description DescriptionInput component for rich text editor with autosave functionality using debounce
 * The component also makes an API call to save the description on unmount
 */
export function DescriptionInput(props: Props) {
  return <DescriptionInputContent {...props} key={props.entityId} />;
}

const DescriptionInputContent = observer(function DescriptionInputContent(props: Props) {
  const {
    containerClassName,
    disabled,
    disabledExtensions,
    editorRef,
    entityId,
    fileAssetType,
    initialValue,
    issueSequenceId,
    onSubmit,
    placeholder,
    projectId,
    setIsSubmitting,
    swrDescription,
    workspaceSlug,
  } = props;
  const incomingValue = swrDescription ?? initialValue;
  const normalizedValue = incomingValue?.trim() === "" ? "<p></p>" : (incomingValue ?? "<p></p>");
  const migrationUpdate = useRef(false);
  const [autosave] = useState(
    () => new TextAutosave(normalizedValue, (html) => onSubmit(html, migrationUpdate.current))
  );
  const [localDescription, setLocalDescription] = useState(normalizedValue);
  const [saveError, setSaveError] = useState<string>();
  const statusCallback = useRef(setIsSubmitting);
  useLayoutEffect(() => {
    statusCallback.current = setIsSubmitting;
  }, [setIsSubmitting]);
  const { getWorkspaceBySlug } = useWorkspace();
  const { uploadEditorAsset, duplicateEditorAsset } = useEditorAsset();
  const workspaceDetails = getWorkspaceBySlug(workspaceSlug);
  const { t } = useTranslation();

  useEffect(() => {
    if (autosave.receive(normalizedValue)) setLocalDescription(normalizedValue);
  }, [autosave, normalizedValue, localDescription]);

  const save = useMemo(
    () =>
      async (retry = false) => {
        if (!autosave.dirty && !autosave.saving && !retry) return;
        statusCallback.current("submitting");
        try {
          await autosave.save(retry);
          if (!autosave.dirty) {
            setLocalDescription(autosave.draft);
            statusCallback.current("submitted");
          }
          setSaveError(undefined);
        } catch (error) {
          statusCallback.current("failed");
          setSaveError(
            error instanceof Error ? error.message : "Description could not be saved. Your changes are retained."
          );
        }
      },
    [autosave]
  );
  const debouncedFormSave = useMemo(() => debounce(save, 1500), [save]);
  useEffect(
    () => () => {
      debouncedFormSave.cancel();
      // A failed save requires an explicit retry; do not retry a conflict on unmount.
      // The owner queues newer dirty text behind an in-flight save without duplicating it.
      if (autosave.canFlushOnUnmount) void save();
    },
    [autosave, debouncedFormSave, save]
  );

  if (!workspaceDetails) return null;

  return (
    <>
      <RichTextEditor
        key={entityId}
        editable={!disabled}
        ref={editorRef}
        id={entityId}
        issueSequenceId={issueSequenceId}
        disabledExtensions={disabledExtensions}
        initialValue={autosave.draft}
        value={autosave.dirty || autosave.saving ? null : localDescription}
        workspaceSlug={workspaceSlug}
        workspaceId={workspaceDetails.id}
        projectId={projectId}
        dragDropEnabled
        onChange={(_json, description_html, options) => {
          if (description_html === autosave.draft) return;
          migrationUpdate.current = !!options?.isMigrationUpdate;
          autosave.edit(description_html, (html) => {
            const isMigrationUpdate = migrationUpdate.current;
            return onSubmit(html, isMigrationUpdate);
          });
          setIsSubmitting(autosave.status);
          debouncedFormSave();
        }}
        placeholder={placeholder ?? ((isFocused, value) => t(getDescriptionPlaceholderI18n(isFocused, value)))}
        searchMentionCallback={async (payload) =>
          await workspaceService.searchEntity(workspaceSlug?.toString() ?? "", {
            ...payload,
            project_id: projectId,
          })
        }
        containerClassName={containerClassName}
        uploadFile={async (blockId, file) => {
          try {
            const { asset_id } = await uploadEditorAsset({
              blockId,
              data: {
                entity_identifier: entityId,
                entity_type: fileAssetType,
              },
              file,
              projectId,
              workspaceSlug,
            });
            return asset_id;
          } catch (error) {
            console.log("Error in uploading asset:", error);
            throw new Error("Asset upload failed. Please try again later.", { cause: error });
          }
        }}
        duplicateFile={async (assetId: string) => {
          try {
            const { asset_id } = await duplicateEditorAsset({
              assetId,
              entityType: fileAssetType,
              projectId,
              workspaceSlug,
            });
            return asset_id;
          } catch {
            throw new Error("Asset duplication failed. Please try again later.");
          }
        }}
      />
      {saveError && (
        <div className="space-y-1">
          <p role="alert" className="text-13 text-danger-primary">
            {saveError}
          </p>
          <Button variant="secondary" disabled={autosave.saving} onClick={() => void save(true)}>
            Retry saving description
          </Button>
        </div>
      )}
    </>
  );
});
