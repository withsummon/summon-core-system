import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { AlertModalCore } from "@plane/ui";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { SummonField } from "@/components/summon/forms";
import { cardClass, mutationMessage, selectClass } from "../commercial/forms";

export const newDocument = {
  name: "",
  access: "private",
  isGlobal: false,
  projectIds: [],
  color: "",
  viewProps: {},
  logoProps: {},
  sortOrder: 0,
  category: "document",
  tags: [],
  clientId: null,
  opportunityId: null,
  externalId: null,
  externalSource: null,
} satisfies Omit<FunctionArgs<typeof api.documents.index.create>, "workspaceId">;
export function MetadataForm({
  workspaceId,
  document,
  canManage,
  onDone,
  onCancel,
  dialog = false,
  initialProjectId,
}: {
  workspaceId: Id<"workspaces">;
  document: Doc<"documents"> | null;
  canManage: boolean;
  onDone: (id: Id<"documents">) => void;
  onCancel: () => void;
  dialog?: boolean;
  initialProjectId?: Id<"projects">;
}) {
  const create = useMutation(api.documents.index.create);
  const update = useMutation(api.documents.index.update);
  const projects = useQuery(api.projects.index.list, { workspaceId });
  const [initialDocument] = useState(document);
  const initial = initialDocument ?? { ...newDocument, projectIds: initialProjectId ? [initialProjectId] : [] };
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<Omit<FunctionArgs<typeof api.documents.index.create>, "workspaceId">>({ defaultValues: initial });
  const access = watch("access");
  const isGlobal = watch("isGlobal");
  const projectIds = watch("projectIds");
  const visibility = access === "private" ? "private" : isGlobal ? "workspace" : "projects";
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const continuation = useRef<typeof onDone | null>(null);
  const leave = useCallback(() => {
    continuation.current = null;
  }, []);
  const release = useReloadConfirmations(
    isDirty || isSubmitting,
    "The page settings have not been saved yet.",
    leave,
    isSubmitting
  );
  useEffect(() => leave, [leave]);
  const visibilityId = useId();
  const close = () => {
    if (isSubmitting) return;
    if (isDirty) setConfirming(true);
    else onCancel();
  };
  const content = (
    <form
      className={cardClass}
      onSubmit={handleSubmit(async (metadata) => {
        continuation.current = onDone;
        setError("");
        try {
          let id: Id<"documents">;
          if (initialDocument) {
            await update({
              documentId: initialDocument._id,
              expectedUpdatedAt: initialDocument.updatedAt,
              category: metadata.category,
              tags: metadata.tags,
              access: metadata.access,
              isGlobal: metadata.isGlobal,
              projectIds: metadata.projectIds,
            });
            id = initialDocument._id;
          } else id = await create({ workspaceId, ...metadata });
          reset(metadata);
          release((allow) => {
            const done = continuation.current;
            continuation.current = null;
            if (allow) done?.(id);
          });
        } catch (failure) {
          if (continuation.current !== null) setError(mutationMessage(failure));
          continuation.current = null;
        }
      })}
    >
      <fieldset disabled={isSubmitting} className="grid gap-4 sm:grid-cols-2">
        {dialog ? (
          <Dialog.Title className="font-semibold sm:col-span-2">Page settings</Dialog.Title>
        ) : (
          <h2 className="font-semibold sm:col-span-2">{document ? "Document settings" : "New document"}</h2>
        )}
        <SummonField label="Document name">
          <Input {...register("name")} required maxLength={255} readOnly={document !== null} />
        </SummonField>
        <SummonField label="Category">
          <Input {...register("category")} maxLength={80} />
        </SummonField>
        <SummonField label="Visibility" htmlFor={visibilityId}>
          <select
            id={visibilityId}
            className={selectClass}
            value={visibility}
            disabled={!canManage}
            onChange={(event) => {
              setValue("access", event.target.value === "private" ? "private" : "public", { shouldDirty: true });
              if (event.target.value !== "private")
                setValue("isGlobal", event.target.value === "workspace", { shouldDirty: true });
            }}
          >
            <option value="private">Private · only you</option>
            <option value="workspace">Workspace members</option>
            <option value="projects">Selected projects</option>
          </select>
        </SummonField>
        <SummonField label="Tags (comma separated)">
          <Input
            defaultValue={initial.tags.join(", ")}
            onChange={(event) =>
              setValue(
                "tags",
                event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                { shouldDirty: true }
              )
            }
          />
        </SummonField>
        {visibility === "projects" && (
          <fieldset className="space-y-2 sm:col-span-2" disabled={!canManage}>
            <legend className="text-sm mb-2 font-medium">Projects</legend>
            {projects
              ?.filter((project) => project.membershipRole !== "guest" && project.workspaceRole !== "guest")
              .map((project) => (
                <label key={project._id} className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={projectIds.includes(project._id)}
                    onChange={(event) =>
                      setValue(
                        "projectIds",
                        event.target.checked
                          ? [...projectIds, project._id]
                          : projectIds.filter((id) => id !== project._id),
                        { shouldDirty: true }
                      )
                    }
                  />
                  {project.name}
                </label>
              ))}
          </fieldset>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger-primary sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save document"}
          </Button>
          <Button variant="secondary" disabled={isSubmitting} onClick={close}>
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );
  return (
    <>
      {dialog ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
        >
          <Dialog.Panel width={EDialogWidth.XXL} className="p-4 sm:p-6">
            {content}
          </Dialog.Panel>
        </Dialog>
      ) : (
        content
      )}
      {confirming && (
        <AlertModalCore
          isOpen
          isSubmitting={isSubmitting}
          handleClose={() => setConfirming(false)}
          handleSubmit={onCancel}
          title="Discard page settings?"
          content="Your changes to the page settings will be lost."
          variant="primary"
          primaryButtonText={{ default: "Discard", loading: "Discarding…" }}
          secondaryButtonText="Keep editing"
        />
      )}
    </>
  );
}
