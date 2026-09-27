/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useEffect, useState, useRef } from "react";
import { debounce } from "lodash-es";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi, TExtensions } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import type { EFileAssetType, TNameDescriptionLoader } from "@plane/types";
import { getDescriptionPlaceholderI18n } from "@plane/utils";
// components
import { RichTextEditor } from "@/components/editor/rich-text";
// hooks
import { useEditorAsset } from "@/hooks/store/use-editor-asset";
import { useWorkspace } from "@/hooks/store/use-workspace";
// plane web services
import { WorkspaceService } from "@/services/workspace.service";
// local imports
import { DescriptionInputLoader } from "./loader";
import { DescriptionAutosave } from "./autosave";
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
   * @description Key, to ensure the editor is re-rendered when the key changes
   */
  key: string;
  /**
   * @description Submit handler, the actual function which will be called when the form is submitted
   */
  onSubmit: (
    value: {
      description_html: string;
      description_json: object | undefined;
    },
    isMigrationUpdate?: boolean
  ) => Promise<void>;
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
  const [autosave] = useState(
    () =>
      new DescriptionAutosave(normalizedValue, (draft) =>
        onSubmit(
          { description_html: draft.description_html, description_json: draft.description_json },
          draft.isMigrationUpdate
        )
      )
  );
  autosave.setSubmit((draft) =>
    onSubmit(
      { description_html: draft.description_html, description_json: draft.description_json },
      draft.isMigrationUpdate
    )
  );
  const [localDescription, setLocalDescription] = useState(normalizedValue);
  const [saveError, setSaveError] = useState<string>();
  const statusCallback = useRef(setIsSubmitting);
  statusCallback.current = setIsSubmitting;
  const { getWorkspaceBySlug } = useWorkspace();
  const { uploadEditorAsset, duplicateEditorAsset } = useEditorAsset();
  const workspaceDetails = getWorkspaceBySlug(workspaceSlug);
  const { t } = useTranslation();

  useEffect(() => {
    if (autosave.receive(normalizedValue)) setLocalDescription(normalizedValue);
  }, [autosave, normalizedValue]);

  const save = useMemo(
    () => async () => {
      try {
        await autosave.save();
        if (!autosave.dirty) {
          setLocalDescription(autosave.draft.description_html);
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
      // A failed save requires another edit/retry; do not retry a conflict on unmount.
      // The owner queues newer dirty text behind an in-flight save without duplicating it.
      if (autosave.canFlushOnUnmount) void save();
    },
    [autosave, debouncedFormSave, save]
  );

  if (!workspaceDetails) return null;

  if (!localDescription) return <DescriptionInputLoader />;

  return (
    <>
      <RichTextEditor
        key={entityId}
        editable={!disabled}
        ref={editorRef}
        id={entityId}
        issueSequenceId={issueSequenceId}
        disabledExtensions={disabledExtensions}
        initialValue={autosave.draft.description_html}
        value={autosave.dirty ? null : localDescription}
        workspaceSlug={workspaceSlug}
        workspaceId={workspaceDetails.id}
        projectId={projectId}
        dragDropEnabled
        onChange={(description_json, description_html, options) => {
          if (description_html === autosave.draft.description_html) return;
          setIsSubmitting("submitting");
          setSaveError(undefined);
          autosave.edit({ description_html, description_json, isMigrationUpdate: !!options?.isMigrationUpdate });
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
        <p role="alert" className="text-13 text-danger-primary">
          {saveError}
        </p>
      )}
    </>
  );
});
