/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useOutletContext, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { useTranslation } from "@plane/i18n";
import { Loader } from "@plane/ui";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedProjectSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import { AutoArchiveAutomation, AutoCloseAutomation, SelectMonthModal } from "@/components/automation";
import { PageHead } from "@/components/core/page-title";
import { SettingsHeading } from "@/components/settings/heading";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { AutomationsProjectSettingsHeader } from "./header";
export { ProjectFeatureSettingsErrorBoundary as ErrorBoundary } from "@/components/settings/project/content/feature-control-item";

function AutomationSettings({ projectId }: { projectId: Id<"projects"> }) {
  const { t } = useTranslation();
  const settings = useQuery(api.projects.inactivity.get, { projectId });
  const save = useMutation(api.projects.inactivity.save);
  const [custom, setCustom] = useState<FunctionArgs<typeof api.projects.inactivity.save> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const release = useReloadConfirmations(
    Boolean(custom) || pending,
    "Inactivity automation changes may not be saved.",
    () => setCustom(null),
    pending
  );
  const command = async (args: FunctionArgs<typeof api.projects.inactivity.save>) => {
    if (pending || !settings?.canConfigure) return false;
    setPending(true);
    setError("");
    try {
      await save(args);
      return true;
    } catch (failure) {
      setError(mutationMessage(failure));
      return false;
    } finally {
      setPending(false);
    }
  };
  if (!settings)
    return (
      <Loader>
        <Loader.Item height="80px" />
      </Loader>
    );
  const handleChange = (changes: FunctionArgs<typeof api.projects.inactivity.save>["changes"]) =>
    command({ projectId, expectedRevision: settings.revision, changes });
  const close = () => {
    if (!pending) {
      release();
      setCustom(null);
      setError("");
    }
  };
  return (
    <section className="w-full">
      <SettingsHeading
        title={t("project_settings.automations.heading")}
        description={t("project_settings.automations.description")}
      />
      {error && !custom && (
        <p role="alert" className="mt-4 text-13 text-danger-primary">
          {error}
        </p>
      )}
      <div className="mt-6">
        <AutoArchiveAutomation
          settings={settings}
          pending={pending || Boolean(custom)}
          handleChange={handleChange}
          onCustomize={() => {
            setError("");
            setCustom({
              projectId,
              expectedRevision: settings.revision,
              changes: { archiveMonths: settings.archiveMonths },
            });
          }}
        />
        <AutoCloseAutomation
          settings={settings}
          pending={pending || Boolean(custom)}
          handleChange={handleChange}
          onCustomize={() => {
            setError("");
            setCustom({ projectId, expectedRevision: settings.revision, changes: { close: settings.close } });
          }}
        />
      </div>
      {custom && (
        <SelectMonthModal
          initialValues={custom}
          months={settings.months}
          canConfigure={settings.canConfigure}
          pending={pending}
          error={error}
          handleClose={close}
          handleChange={async (months) => {
            const changes = custom.changes.close
              ? { close: { ...custom.changes.close, months } }
              : { archiveMonths: months };
            if (await command({ ...custom, changes })) close();
          }}
        />
      )}
    </section>
  );
}
export default function AutomationSettingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId } = useParams();
  const project = useQuery(
    api.projects.features.resolve,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  if (!project)
    return (
      <Loader>
        <Loader.Item height="42px" />
      </Loader>
    );
  return (
    <PreservedProjectSettingsShell
      {...session}
      project={project}
      authorized={project.role !== "guest"}
      activePath="common.automations"
      header={<AutomationsProjectSettingsHeader />}
    >
      <PageHead title={`${project.name} - Automations`} />
      <AutomationSettings key={project.projectId} projectId={project.projectId} />
    </PreservedProjectSettingsShell>
  );
}
