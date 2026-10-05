/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Popover } from "@plane/propel/popover";
import { WorkItemsIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header } from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";

import { ViewDisplayFields, ProjectReferenceFilters } from "@/components/convex-core/saved-views/form";
import { BasicFilters } from "@/components/convex-core/saved-views/filters";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations, { usePendingConfirmation, useReloadSubmitting } from "@/hooks/use-reload-confirmation";

import { WorkItemsModal } from "@/components/analytics/work-items/modal";

type Preferences = FunctionReturnType<typeof api.projects.navigation.getTaskPreferences>;
type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;

export function ProjectIssuesHeader({ address, onCreate }: { address: Address; onCreate?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const analyticsScope = useMemo(
    () => ({
      workspaceId: address.workspace._id,
      projectIds: [],
      focus: { projectId: address.project._id, cycleId: null, moduleId: null },
    }),
    [address.workspace._id, address.project._id]
  );
  const preferences = useQuery(api.projects.navigation.getTaskPreferences, { projectId: address.project._id });
  const save = useMutation(api.projects.navigation.saveTaskPreferences);
  const busy = useReloadSubmitting();
  return (
    <>
      <WorkItemsModal
        key={JSON.stringify([address.workspaceRole, address.projectRole])}
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        scope={analyticsScope}
        title={address.project.name}
        workspaceSlug={address.workspace.slug}
      />
      <Header>
        <Header.LeftItem>
          <Breadcrumbs onBack={() => navigate(-1)} className="flex-grow-0">
            <Breadcrumbs.Item component={<BreadcrumbLink label={address.project.name} />} />
            <Breadcrumbs.Item
              component={
                <BreadcrumbLink
                  label="Work Items"
                  href={`/${address.workspace.slug}/projects/${address.project._id}/issues/`}
                  icon={<WorkItemsIcon className="size-4 text-tertiary" />}
                  isLast
                />
              }
              isLast
            />
          </Breadcrumbs>
        </Header.LeftItem>
        <Header.RightItem>
          <Button variant="secondary" size="lg" disabled={busy} onClick={() => setAnalyticsOpen(true)}>
            Analytics
          </Button>
          <TaskPreferencesControls
            key={address.project._id}
            projectId={address.project._id}
            preferences={preferences}
            onApply={(changes) => save({ projectId: address.project._id, ...changes })}
          />
          {onCreate && (
            <Button size="lg" disabled={busy} onClick={onCreate}>
              {t("issue.add.label")}
            </Button>
          )}
        </Header.RightItem>
      </Header>
    </>
  );
}

export function TaskPreferencesControls({
  projectId,
  preferences,
  onApply,
}: {
  projectId: Address["project"]["_id"];
  preferences: Preferences | undefined;
  onApply: (
    args: Pick<FunctionArgs<typeof api.projects.navigation.saveTaskPreferences>, "expectedRevision" | "changes">
  ) => Promise<FunctionReturnType<typeof api.projects.navigation.saveTaskPreferences>>;
}) {
  const [editor, setEditor] = useState<{
    original: Preferences;
    draft: Preferences;
  } | null>(null);
  const [openSection, setOpenSection] = useState<"Display" | "Filters" | null>(null);
  const discard = useCallback(() => {
    setEditor(null);
    setOpenSection(null);
  }, []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const isSubmitting = useReloadSubmitting();
  const busy = pending || isSubmitting;
  const releaseDraft = useReloadConfirmations(
    !!editor && JSON.stringify(editor.draft) !== JSON.stringify(editor.original),
    "Your work item display and filter changes have not been saved.",
    discard
  );
  const beginPending = usePendingConfirmation("Your work item preferences are still saving.");
  return (
    <>
      {(["Display", "Filters"] as const).map((section) => (
        <Popover
          key={section}
          open={openSection === section}
          onOpenChange={(open) => {
            if (busy) return;
            if (open && preferences) {
              setError("");
              setEditor((current) => current ?? { original: preferences, draft: preferences });
              setOpenSection(section);
            } else if (!open) setOpenSection(null);
          }}
        >
          <Popover.Button
            disabled={!preferences || busy}
            className="rounded px-3 py-2 text-13 hover:bg-layer-1 disabled:opacity-50"
          >
            {section}
          </Popover.Button>
          <Popover.Panel
            side="bottom"
            align="end"
            sideOffset={4}
            className="max-h-[80vh] w-[min(34rem,calc(100vw-2rem))] overflow-auto rounded-md border border-subtle bg-surface-1 p-4 shadow-raised-200"
          >
            {editor && openSection === section && (
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (busy) return;
                  const snapshot = editor;
                  const releasePending = beginPending();
                  setPending(true);
                  setError("");
                  try {
                    const { revision: _revision, ...changes } = snapshot.draft;
                    await onApply({
                      expectedRevision: snapshot.original.revision,
                      changes,
                    });
                    releaseDraft();
                    discard();
                  } catch (failure) {
                    setError(mutationMessage(failure));
                  } finally {
                    setPending(false);
                    releasePending();
                  }
                }}
              >
                <fieldset disabled={busy} className="space-y-4">
                  <legend className="mb-3 text-14 font-medium">{section}</legend>
                  {section === "Display" ? (
                    <ViewDisplayFields
                      displayFilters={editor.draft.displayFilters}
                      displayProperties={editor.draft.displayProperties}
                      disabled={busy}
                      onChange={(display) => setEditor({ ...editor, draft: { ...editor.draft, ...display } })}
                    />
                  ) : (
                    <>
                      <BasicFilters
                        filters={editor.draft.filters}
                        onChange={(filters) => setEditor({ ...editor, draft: { ...editor.draft, filters } })}
                      />
                      <ProjectReferenceFilters
                        projectId={projectId}
                        filters={editor.draft.filters}
                        selections={undefined}
                        onChange={(filters) => setEditor({ ...editor, draft: { ...editor.draft, filters } })}
                      />
                    </>
                  )}
                </fieldset>
                <div className="flex gap-2">
                  <Button type="submit" loading={pending} disabled={busy}>
                    Apply
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={discard}>
                    Cancel
                  </Button>
                </div>
                {error && (
                  <p role="alert" className="text-14 text-danger-primary">
                    {error}
                  </p>
                )}
              </form>
            )}
          </Popover.Panel>
        </Popover>
      ))}
    </>
  );
}
