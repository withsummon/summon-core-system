import { Component } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { FavoriteToggle } from "@/components/convex-core/favorites/toggle";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { NativeProjectFeatureSelection } from "../project-feature-update";

export class ProjectCreationAccessBoundary extends Component<
  { children: ReactNode; onClose?: () => void; pending?: boolean },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="space-y-3 p-3">
        <p role="alert" className="text-13 text-danger-primary">
          Project setup is unavailable. Your draft is retained.
        </p>
        <Button variant="secondary" disabled={this.props.pending} onClick={() => this.setState({ failed: false })}>
          Retry access
        </Button>
        {this.props.onClose && (
          <Button variant="secondary" disabled={this.props.pending} onClick={this.props.onClose}>
            Close
          </Button>
        )}
      </div>
    ) : (
      this.props.children
    );
  }
}

export function NativeProjectCreateCompletion({
  workspaceId,
  project,
  features,
  onFeatures,
  pending,
  onBusy,
  coverSaved,
  coverRevision,
  onCoverRefresh,
  onCoverRetry,
  onFeaturesRefresh,
  onClose,
  onFinish,
}: {
  workspaceId: Id<"workspaces">;
  project: FunctionReturnType<typeof api.projects.features.resolve>;
  features: FunctionArgs<typeof api.projects.features.save>;
  onFeatures: (features: FunctionArgs<typeof api.projects.features.save>) => void;
  pending: boolean;
  onBusy: (busy: boolean) => void;
  coverSaved: boolean;
  coverRevision: FunctionReturnType<typeof api.projects.cover.get>["revision"];
  onCoverRefresh: (appearance: FunctionReturnType<typeof api.projects.cover.get>) => void;
  onCoverRetry: () => void;
  onFeaturesRefresh: (current: FunctionReturnType<typeof api.projects.features.get>) => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const current = useQuery(api.projects.features.get, { projectId: project.projectId });
  const appearance = useQuery(api.projects.cover.get, { projectId: project.projectId });
  if (current === undefined || appearance === undefined)
    return (
      <div className="space-y-3 p-6">
        <p role="status" className="text-13 text-secondary">
          Loading project setup…
        </p>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    );
  const disabled = pending || !current.canConfigure;
  const coverChanged = appearance.revision !== coverRevision;
  const featuresChanged = current.revision !== features.expectedRevision;
  return (
    <>
      <div className="space-y-3 px-6 pt-5">
        {appearance.cover && (
          <AuthenticatedAssetImage
            asset={appearance.cover}
            alt={t("project_cover_image_alt")}
            className="h-24 w-full rounded-md object-cover"
          />
        )}
        {!coverSaved && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-13 text-secondary">
              {coverChanged
                ? "The saved cover changed. Keep your selected cover, then retry to replace the saved cover."
                : "Your project was created. Its selected cover still needs to be saved."}
            </p>
            <Button
              variant="secondary"
              disabled={pending || !appearance.canManage}
              onClick={() => {
                if (coverChanged) onCoverRefresh(appearance);
                else onCoverRetry();
              }}
            >
              {coverChanged ? "Keep my selected cover" : "Retry cover"}
            </Button>
          </div>
        )}
        {!coverSaved && coverChanged && appearance.externalCoverUrl && (
          <a
            href={appearance.externalCoverUrl}
            target="_blank"
            rel="noreferrer"
            className="text-13 text-accent-primary"
          >
            View current external cover
          </a>
        )}
        {featuresChanged && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-13 text-secondary">
              Project settings changed. Review the saved values below, then keep your choices. Open project will save
              your choices over those values.
            </p>
            <Button variant="secondary" disabled={disabled} onClick={() => onFeaturesRefresh(current)}>
              Keep my feature choices
            </Button>
          </div>
        )}
        {!current.canConfigure && (
          <p className="text-13 text-secondary">Project setup is read-only. Your changes are retained.</p>
        )}
        <FavoriteToggle
          workspaceId={workspaceId}
          target={{ type: "project", id: project.projectId }}
          disabled={pending}
          onBusy={onBusy}
        />
      </div>
      <NativeProjectFeatureSelection
        value={features}
        onChange={onFeatures}
        savedFeatures={featuresChanged ? current.features : undefined}
        disabled={disabled}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-subtle px-6 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1 text-13 font-medium text-tertiary">
          {t("congrats")} <Logo logo={project.logo ?? undefined} /> <span className="break-all">{project.name}</span>{" "}
          {t("created").toLowerCase()}.
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="lg" disabled={pending} onClick={onClose}>
            {t("close")}
          </Button>
          <Button size="lg" loading={pending} disabled={disabled || !coverSaved || featuresChanged} onClick={onFinish}>
            {t("open_project")}
          </Button>
        </div>
      </div>
    </>
  );
}
