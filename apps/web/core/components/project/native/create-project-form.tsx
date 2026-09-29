import { useEffect, useId, useState } from "react";
import type { ComponentProps } from "react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Input, TextArea } from "@plane/ui";
import { projectIdentifierSanitizer } from "@plane/utils";
import { ImagePickerPopoverView } from "@/components/core/image-picker-popover";
import { attachmentContentType } from "@/components/convex-core/tasks/attachments/upload-file";
import { ProjectCreateHeaderView, ProjectLogoPicker } from "../create/header";
import { ProjectCommonAttributesView } from "../create/common-attributes";
import { ProjectCreateButtonsView } from "../create/project-create-buttons";
import { NativeProjectAttributes } from "@/components/projects/create/attributes";
import { ProjectCreationAccessBoundary } from "./create-project-completion";

type Draft = Omit<FunctionArgs<typeof api.projects.index.create>, "logoProps">;

export function NativeProjectCreateForm({
  draft,
  onChange,
  logo,
  onLogo,
  cover,
  onCover,
  policy,
  pending,
  canCreate,
  onClose,
  onSubmit,
}: {
  draft: Draft;
  onChange: (fields: Partial<Draft>) => void;
  logo: ComponentProps<typeof ProjectLogoPicker>["value"];
  onLogo: ComponentProps<typeof ProjectLogoPicker>["onChange"];
  cover: string | File;
  onCover: (cover: string | File) => void;
  policy: FunctionReturnType<typeof api.assets.index.policy> | undefined;
  pending: boolean;
  canCreate: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [autoIdentifier, setAutoIdentifier] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const disabled = pending || !canCreate;
  useEffect(() => {
    if (typeof cover === "string") return;
    const url = URL.createObjectURL(cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);
  const coverUrl = typeof cover === "string" ? cover : preview;
  return (
    <>
      <ProjectCreateHeaderView
        handleClose={onClose}
        disabled={pending}
        cover={
          coverUrl && (
            <img
              src={coverUrl}
              alt={t("project_cover_image_alt")}
              className="absolute top-0 left-0 h-full w-full rounded-lg object-cover"
            />
          )
        }
        coverPicker={
          <ImagePickerPopoverView
            label={t("change_cover")}
            value={coverUrl}
            disabled={disabled || !policy}
            onSelect={async (url) => {
              if (disabled) throw new Error("Project creation is read-only. Your draft is retained.");
              onCover(url);
            }}
            onUpload={async (file) => {
              if (disabled || !policy) throw new Error("Project creation is read-only. Your draft is retained.");
              if (!attachmentContentType(file, policy).startsWith("image/"))
                throw new Error("Choose a supported image.");
              onCover(file);
            }}
          />
        }
        logoPicker={<ProjectLogoPicker value={logo} disabled={disabled} onChange={onLogo} />}
      />
      <form
        className="px-3"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) onSubmit();
        }}
      >
        <fieldset disabled={disabled} className="mt-9 space-y-6 pb-5">
          <ProjectCommonAttributesView
            name={
              <Input
                id={`${id}-name`}
                name="name"
                required
                maxLength={255}
                aria-label={t("project_name")}
                placeholder={t("project_name")}
                className="focus:border-blue-400 w-full"
                value={draft.name}
                onChange={(event) =>
                  onChange(
                    autoIdentifier
                      ? {
                          name: event.target.value,
                          identifier: projectIdentifierSanitizer(event.target.value).toUpperCase().slice(0, 12),
                        }
                      : { name: event.target.value }
                  )
                }
              />
            }
            identifier={
              <Input
                id={`${id}-identifier`}
                name="identifier"
                required
                maxLength={12}
                aria-label={t("project_id")}
                placeholder={t("project_id")}
                className="focus:border-blue-400 w-full text-11 uppercase"
                value={draft.identifier}
                onChange={(event) => {
                  setAutoIdentifier(false);
                  onChange({ identifier: projectIdentifierSanitizer(event.target.value).toUpperCase() });
                }}
              />
            }
            description={
              <TextArea
                id={`${id}-description`}
                name="description"
                aria-label={t("description")}
                placeholder={t("description")}
                className="focus:border-blue-400 !h-24 text-13"
                maxLength={20000}
                value={draft.description ?? ""}
                onChange={(event) => onChange({ description: event.target.value })}
              />
            }
          />
          <ProjectCreationAccessBoundary>
            <NativeProjectAttributes value={draft} onChange={onChange} canCreate={canCreate} disabled={disabled} />
          </ProjectCreationAccessBoundary>
        </fieldset>
        {!canCreate && (
          <p className="pb-4 text-13 text-secondary">Project creation is read-only. Your draft is retained.</p>
        )}
        <ProjectCreateButtonsView handleClose={onClose} isSubmitting={pending} disabled={!canCreate || !policy} />
      </form>
    </>
  );
}
