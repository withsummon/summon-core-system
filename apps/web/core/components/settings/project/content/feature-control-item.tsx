/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useOutletContext, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/app/native-workspace";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { ToggleSwitch } from "@plane/ui";
import { PageHead } from "@/components/core/page-title";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { SettingsHeading } from "@/components/settings/heading";
import {
  PreservedProjectSettingsShell,
  PreservedWorkspaceSettingsShell,
} from "@/components/workspace/native-shell/workspace-shell";
import { mutationMessage } from "@/components/convex-core/commercial/forms";

type Configuration = FunctionReturnType<typeof api.projects.features.resolve>;

export function ProjectFeatureSettings({
  feature,
  header,
}: {
  feature: keyof Configuration["features"];
  header: ReactNode;
}) {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId } = useParams();
  const { t } = useTranslation();
  const project = useQuery(
    api.projects.features.resolve,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  if (!project)
    return (
      <p role="status" className="p-8">
        Loading project settings…
      </p>
    );
  return (
    <>
      <PageHead title={`${project.name} settings - ${t(`project_settings.features.${feature}.short_title`)}`} />
      <PreservedProjectSettingsShell
        {...session}
        project={project}
        activePath={`project_settings.features.${feature}.short_title`}
        header={header}
      >
        <section className="w-full">
          <SettingsHeading
            title={t(`project_settings.features.${feature}.title`)}
            description={t(`project_settings.features.${feature}.description`)}
          />
          <div className="mt-7">
            <FeatureControl key={`${project.projectId}:${feature}`} feature={feature} project={project} />
          </div>
        </section>
      </PreservedProjectSettingsShell>
    </>
  );
}

function FeatureControl({ feature, project }: { feature: keyof Configuration["features"]; project: Configuration }) {
  const { t } = useTranslation();
  const save = useMutation(api.projects.features.save);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const title = t(`project_settings.features.${feature}.toggle_title`);
  const update = async (value: boolean) => {
    if (pending || !project.canConfigure) return;
    const { intake, ...features } = project.features;
    setPending(true);
    setError("");
    try {
      await save({
        projectId: project.projectId,
        expectedRevision: project.revision,
        features: feature === "intake" ? features : { ...features, [feature]: value },
        intake: feature === "intake" ? value : intake,
      });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Project feature updated successfully." });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <SettingsBoxedControlItem
        title={title}
        description={t(`project_settings.features.${feature}.toggle_description`)}
        control={
          <ToggleSwitch
            value={project.features[feature]}
            onChange={(value) => void update(value)}
            disabled={pending || !project.canConfigure}
            size="sm"
            label={title}
          />
        }
      />
      {error && (
        <p role="alert" className="mt-3 text-14 text-danger-primary">
          {error}
        </p>
      )}
    </>
  );
}

export function ProjectFeatureSettingsErrorBoundary() {
  const session = useOutletContext<WorkspaceSession>();
  return (
    <PreservedWorkspaceSettingsShell {...session} activePath="common.features" header={null}>
      <section className="space-y-4">
        <h1 className="text-h3-medium">Project settings are unavailable</h1>
        <p role="alert" className="text-body-xs-regular text-danger-primary">
          Check this project's address and your access, then reload settings.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload settings
          </Button>
          <Link className="text-link-primary" to={`/${session.workspace.slug}/stickies/`}>
            Back to workspace
          </Link>
        </div>
      </section>
    </PreservedWorkspaceSettingsShell>
  );
}
