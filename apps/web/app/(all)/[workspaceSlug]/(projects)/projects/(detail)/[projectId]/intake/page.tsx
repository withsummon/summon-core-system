/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import type { ComponentProps } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { useTranslation } from "@plane/i18n";
import { Header, EHeaderVariant, Breadcrumbs } from "@plane/ui";
import { IntakeIcon } from "@plane/propel/icons";
import darkIntakeAsset from "@/app/assets/empty-state/disabled-feature/intake-dark.webp?url";
import lightIntakeAsset from "@/app/assets/empty-state/disabled-feature/intake-light.webp?url";
import { PageHead } from "@/components/core/page-title";
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
import { IntakeBoundary, IntakeView } from "@/components/convex-core/intakes/intakes";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import type { Route } from "./+types/page";

const selectionParams = (current: URLSearchParams, id: Id<"tasks"> | null, created = false) => {
  const next = new URLSearchParams(current);
  next.delete("comment");
  if (created) {
    next.set("currentTab", "open");
    next.delete("intakeStatus");
  }
  if (id) next.set("inboxIssueId", id);
  else next.delete("inboxIssueId");
  return next;
};

export default function ProjectInboxPage({ params }: Route.ComponentProps) {
  const navigate = useNavigate();
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const [searchParams, setSearchParams] = useSearchParams();
  const address = useQuery(api.navigation.address.resolveProjectId, {
    workspaceId: session.workspace._id,
    projectId: params.projectId,
  });
  const config = useQuery(api.intakes.index.getConfig, address ? { projectId: address.project._id } : "skip");
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const tabs = [
    { value: "open", label: t("inbox_issue.tabs.open") },
    { value: "closed", label: t("inbox_issue.tabs.closed") },
  ] as const satisfies ComponentProps<typeof IntakeView>["views"];
  const view =
    searchParams.get("intakeStatus") === "trash"
      ? "trash"
      : (tabs.find((tab) => tab.value === searchParams.get("currentTab"))?.value ?? "open");
  const changeView: ComponentProps<typeof IntakeView>["onViewChange"] = (nextView) =>
    setSearchParams((current) => {
      const next = selectionParams(current, null);
      next.delete("intakeSelection");
      if (nextView === "trash") next.set("intakeStatus", "trash");
      else {
        next.delete("intakeStatus");
        next.set("currentTab", nextView);
      }
      return next;
    });
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <div className="flex h-full min-h-0 flex-col">
        <PageHead title={t("inbox_issue.page_label", { workspace: address?.project.name ?? "Plane" })} />
        <Header variant={EHeaderVariant.PRIMARY} className="shrink-0 px-4">
          <Breadcrumbs>
            <Breadcrumbs.Item component={<span className="text-13">{address?.project.name}</span>} />
            <Breadcrumbs.Item
              component={
                <span className="flex items-center gap-2 text-13">
                  <IntakeIcon className="size-4" />
                  Intake
                </span>
              }
            />
          </Breadcrumbs>
        </Header>
        {!address || !config ? (
          <p role="status" className="p-6">
            Loading intake…
          </p>
        ) : !config.enabled ? (
          <div className="flex flex-1 items-center justify-center">
            <DetailedEmptyState
              title={t("disabled_project.empty_state.inbox.title")}
              description={t("disabled_project.empty_state.inbox.description")}
              assetPath={resolvedTheme === "light" ? lightIntakeAsset : darkIntakeAsset}
              primaryButton={{
                text: t("disabled_project.empty_state.inbox.primary_button.text"),
                onClick: () => navigate(`/${session.workspace.slug}/settings/projects/${address.project._id}/features`),
                disabled: !config.canConfigure,
              }}
            />
          </div>
        ) : (
          <IntakeBoundary
            key={JSON.stringify([address.project._id, view, searchParams.get("intakeSelection")])}
            recoveryLabel="Clear filters"
            onBack={() =>
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.delete("intakeSelection");
                return next;
              })
            }
          >
            <IntakeView
              project={address.project}
              workspaceSlug={session.workspace.slug}
              view={view}
              views={[...tabs, { value: "trash", label: "Trash" }]}
              selected={searchParams.get("inboxIssueId")}
              selectionHref={(id) => `?${selectionParams(searchParams, id)}`}
              onSelect={(id, created) => setSearchParams((current) => selectionParams(current, id, created))}
              onViewChange={changeView}
              onRestored={(status) => changeView(status === "pending" || status === "snoozed" ? "open" : "closed")}
            />
          </IntakeBoundary>
        )}
      </div>
    </PreservedWorkspaceShell>
  );
}
