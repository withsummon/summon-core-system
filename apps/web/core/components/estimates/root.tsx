/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TrashIcon } from "@plane/propel/icons";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { ToggleSwitch } from "@plane/ui";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { SettingsHeading } from "@/components/settings/heading";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { EstimateProgress, EstimateRemoval } from "@/components/convex-core/estimates/removal";
import { CreateEstimateModal } from "./create/modal";
import { EstimateLoaderScreen } from "./loader-screen";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

export function EstimateRoot({ projectId }: { projectId: FunctionArgs<typeof api.estimates.index.list>["projectId"] }) {
  const configuration = useQuery(api.estimates.index.list, { projectId });
  const select = useMutation(api.estimates.index.select);
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<FunctionReturnType<typeof api.estimates.index.get> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useReloadConfirmations(pending, "An estimate setting is still saving.", undefined, pending);
  if (!configuration) return <EstimateLoaderScreen />;
  const current = configuration.config?.lastUsedSystemId;
  const archived = configuration.systems.filter((system) => system._id !== current);
  return (
    <>
      <SettingsHeading
        title={t("project_settings.estimates.heading")}
        description={t("project_settings.estimates.description")}
      />
      <div className="mt-6">
        {configuration.config?.jobId && (
          <EstimateProgress jobId={configuration.config.jobId} canWrite={configuration.canWrite} />
        )}
        {current ? (
          <>
            <SettingsBoxedControlItem
              title={t("project_settings.estimates.title")}
              description={t("project_settings.estimates.enable_description")}
              control={
                <ToggleSwitch
                  label={t("project_settings.estimates.title")}
                  size="sm"
                  value={!!configuration.config?.activeSystemId}
                  disabled={pending || !configuration.canSelect || !!configuration.config?.jobId}
                  onChange={async (enabled) => {
                    setPending(true);
                    setError("");
                    try {
                      await select({
                        projectId,
                        systemId: enabled ? current : null,
                        expectedRevision: configuration.config?.revision ?? 0,
                      });
                      setToast({
                        type: TOAST_TYPE.SUCCESS,
                        title: t(`project_settings.estimates.toasts.${enabled ? "enabled" : "disabled"}.success.title`),
                        message: t(
                          `project_settings.estimates.toasts.${enabled ? "enabled" : "disabled"}.success.message`
                        ),
                      });
                    } catch (failure) {
                      setError(mutationMessage(failure));
                    } finally {
                      setPending(false);
                    }
                  }}
                />
              }
            />
            <div className="mt-12 flex flex-col gap-y-4">
              <SettingsHeading title="Estimates list" variant="h6" />
              <EstimateCard
                systemId={current}
                canDelete={configuration.canSelect && configuration.canWrite && !configuration.config?.jobId}
                onDelete={setRemoving}
              />
            </div>
          </>
        ) : (
          <EmptyStateCompact
            assetKey="estimate"
            assetClassName="size-20"
            title={t("settings_empty_state.estimates.title")}
            description={t("settings_empty_state.estimates.description")}
            actions={
              configuration.canSelect && configuration.canWrite && !configuration.config?.jobId
                ? [{ label: t("settings_empty_state.estimates.cta_primary"), onClick: () => setCreating(true) }]
                : []
            }
            align="start"
            rootClassName="py-20"
          />
        )}
        {error && (
          <p role="alert" className="mt-3 text-14 text-danger-primary">
            {error}
          </p>
        )}
        {archived.length > 0 && (
          <div className="mt-12 flex flex-col gap-y-4">
            <SettingsHeading
              title="Archived estimates"
              description={
                <>
                  Estimates have gone through a change, these are the estimates you had in your older versions which
                  were not in use. Read more about them&nbsp;
                  <a
                    href="https://docs.plane.so/core-concepts/projects/run-project#estimate"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-primary/80 hover:text-accent-primary"
                  >
                    here.
                  </a>
                </>
              }
              variant="h6"
            />
            <div>
              {archived.map((system) => (
                <EstimateCard key={system._id} systemId={system._id} canDelete={false} onDelete={setRemoving} />
              ))}
            </div>
          </div>
        )}
      </div>
      {creating && (
        <CreateEstimateModal projectId={projectId} configuration={configuration} onClose={() => setCreating(false)} />
      )}
      {removing && <EstimateRemoval system={removing} point={null} onClose={() => setRemoving(null)} />}
    </>
  );
}

function EstimateCard({
  systemId,
  canDelete,
  onDelete,
}: {
  systemId: FunctionArgs<typeof api.estimates.index.get>["systemId"];
  canDelete: boolean;
  onDelete: (system: FunctionReturnType<typeof api.estimates.index.get>) => void;
}) {
  const system = useQuery(api.estimates.index.get, { systemId });
  if (!system) return <p role="status">Loading estimate system…</p>;
  return (
    <SettingsBoxedControlItem
      title={system.name}
      description={system.points.map((point) => point.value).join(", ")}
      control={
        canDelete && (
          <Button variant="link" size="sm" aria-label={`Delete ${system.name}`} onClick={() => onDelete(system)}>
            <TrashIcon width={14} height={14} />
          </Button>
        )
      }
    />
  );
}
