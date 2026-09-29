import { useCallback, useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { useNavigate } from "react-router";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { getRandomCoverImage } from "@/helpers/cover-image.helper";
import { getNativeProjectFormValues } from "@/components/projects/create/utils";
import { AssetTransfers } from "@/components/convex-core/documents/asset-transfers";
import { uploadFileAsset } from "@/components/convex-core/assets/upload-file";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { NativeProjectCreateForm } from "./create-project-form";
import type { ProjectLogoPicker } from "../create/header";
import { NativeProjectCreateCompletion, ProjectCreationAccessBoundary } from "./create-project-completion";

export function NativeCreateProjectModal({
  workspaceId,
  workspaceSlug,
  onClose,
  onCreated,
}: {
  workspaceId: Id<"workspaces">;
  workspaceSlug: string;
  onClose: () => void;
  onCreated?: (projectId: Id<"projects">) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = useConvex();
  const create = useMutation(api.projects.index.create);
  const prepareCover = useMutation(api.projects.cover.prepare);
  const finalize = useAction(api.assets.upload.finalize);
  const saveFeatures = useMutation(api.projects.features.save);
  const workspaces = useQuery(api.workspaces.index.list, {});
  const policy = useQuery(api.assets.index.policy, {});
  const workspace = workspaces?.find((row) => row._id === workspaceId);
  const canCreate = workspace !== undefined && workspace.membershipRole !== "guest";
  const [initial] = useState(() => getNativeProjectFormValues(workspaceId));
  const { logoProps: initialLogo, ...initialFields } = initial;
  const [draft, setDraft] = useState<Omit<FunctionArgs<typeof api.projects.index.create>, "logoProps">>(initialFields);
  const [logo, setLogo] = useState<ComponentProps<typeof ProjectLogoPicker>["value"]>(initialLogo);
  const [initialCover] = useState(getRandomCoverImage);
  const [cover, setCover] = useState<string | File>(initialCover);
  const [createdId, setCreatedId] = useState<FunctionReturnType<typeof api.projects.index.create> | null>(null);
  const [project, setProject] = useState<FunctionReturnType<typeof api.projects.features.resolve> | null>(null);
  const [appearance, setAppearance] = useState<FunctionReturnType<typeof api.projects.cover.get> | null>(null);
  const [features, setFeatures] = useState<FunctionArgs<typeof api.projects.features.save> | null>(null);
  const [coverAssetId, setCoverAssetId] = useState<FunctionReturnType<typeof api.assets.upload.finalize> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [transfers] = useState(() => new AssetTransfers());
  useEffect(() => () => transfers.dispose(), [transfers]);
  const featureDirty =
    project !== null &&
    features !== null &&
    JSON.stringify({ ...features.features, intake: features.intake }) !== JSON.stringify(project.features);
  const dirty =
    createdId !== null
      ? coverAssetId === null || featureDirty
      : cover !== initialCover ||
        JSON.stringify(draft) !== JSON.stringify(initialFields) ||
        JSON.stringify(logo) !== JSON.stringify(initialLogo);
  const leave = useCallback(() => onClose(), [onClose]);
  const release = useReloadConfirmations(dirty, "This project has unfinished setup changes.", leave, pending);
  const dismiss = () => {
    if (!pending) {
      if (dirty) setDiscarding(true);
      else onClose();
    }
  };
  const run = async (operation: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await operation();
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  const capture = async (projectId: Id<"projects">) => {
    const [configuration, coverState] = await Promise.all([
      client.query(api.projects.features.resolve, { workspaceId, projectId }),
      client.query(api.projects.cover.get, { projectId }),
    ]);
    setProject(configuration);
    setAppearance(coverState);
    const { intake, ...selected } = configuration.features;
    setFeatures({ projectId, expectedRevision: configuration.revision, features: selected, intake });
    return coverState;
  };
  const saveCover = async (projectId: Id<"projects">, captured: FunctionReturnType<typeof api.projects.cover.get>) => {
    if (!policy) throw new Error("Cover upload policy is unavailable. Your selected cover is retained.");
    if (coverAssetId !== null) return;
    const file =
      typeof cover === "string"
        ? await transfers.run(async (signal) => {
            const response = await fetch(cover, { signal });
            if (!response.ok) throw new Error("The selected cover could not be loaded. Retry its upload.");
            const blob = await response.blob();
            return new File([blob], "project-cover.jpg", { type: blob.type });
          })
        : cover;
    const assetId = await transfers.run((signal) =>
      uploadFileAsset(
        file,
        policy,
        (metadata) => prepareCover({ projectId, expectedRevision: captured.revision, ...metadata }),
        finalize,
        signal
      )
    );
    setCoverAssetId(assetId);
  };
  const submit = () =>
    void run(async () => {
      if (!canCreate || createdId !== null) return;
      const projectId = await create({ ...draft, logoProps: logo });
      setCreatedId(projectId);
      const captured = await capture(projectId);
      await saveCover(projectId, captured);
    });
  const finish = () =>
    void run(async () => {
      if (!createdId || !project || !features || coverAssetId === null) return;
      if (featureDirty) {
        await saveFeatures(features);
        setProject({ ...project, features: { ...features.features, intake: features.intake } });
      }
      release((allowDefaultNavigation) => {
        onClose();
        if (!allowDefaultNavigation) return;
        if (onCreated) onCreated(createdId);
        else navigate(`/${workspaceSlug}/projects/${createdId}/issues/`);
      });
    });
  return (
    <ModalCore isOpen handleClose={dismiss} position={EModalPosition.TOP} width={EModalWidth.XXXXL}>
      <Dialog.Title className="sr-only">
        {createdId === null ? t("create_project") : t("projects_and_issues")}
      </Dialog.Title>
      {createdId === null ? (
        <NativeProjectCreateForm
          draft={draft}
          logo={logo}
          onLogo={setLogo}
          onChange={(fields) => setDraft({ ...draft, ...fields })}
          cover={cover}
          onCover={setCover}
          policy={policy}
          pending={pending}
          canCreate={canCreate}
          onClose={dismiss}
          onSubmit={submit}
        />
      ) : project && features && appearance ? (
        <ProjectCreationAccessBoundary onClose={dismiss} pending={pending}>
          <NativeProjectCreateCompletion
            workspaceId={workspaceId}
            project={project}
            features={features}
            onFeatures={setFeatures}
            pending={pending}
            onBusy={setPending}
            coverSaved={coverAssetId !== null}
            coverRevision={appearance.revision}
            onCoverRefresh={(current) => {
              setAppearance(current);
              setError("");
            }}
            onCoverRetry={() => {
              void run(() => saveCover(createdId, appearance));
            }}
            onFeaturesRefresh={(current) => {
              setProject({ ...project, features: current.features, revision: current.revision });
              setFeatures({ ...features, expectedRevision: current.revision });
              setError("");
            }}
            onClose={dismiss}
            onFinish={finish}
          />
        </ProjectCreationAccessBoundary>
      ) : (
        <div className="space-y-3 p-6">
          <p>Your project was created. Its setup draft is retained.</p>
          <Button
            variant="secondary"
            disabled={pending || !canCreate}
            onClick={() =>
              void run(async () => {
                const captured = await capture(createdId);
                await saveCover(createdId, captured);
              })
            }
          >
            Continue setup
          </Button>
          <Button variant="secondary" disabled={pending} onClick={dismiss}>
            {t("close")}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="px-6 py-3 text-13 text-danger-primary">
          {error}
        </p>
      )}
      {discarding && (
        <div role="alert" className="space-y-3 border-t border-subtle p-5">
          <p>
            {createdId === null
              ? "Discard this project draft?"
              : "Discard unfinished setup? The created project will remain."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDiscarding(false)}>
              Keep editing
            </Button>
            <Button variant="error-fill" disabled={pending} onClick={() => release(() => onClose())}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </ModalCore>
  );
}
