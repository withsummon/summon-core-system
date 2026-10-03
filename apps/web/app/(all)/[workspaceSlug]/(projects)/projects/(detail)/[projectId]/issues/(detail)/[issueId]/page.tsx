/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTheme } from "next-themes";
import { Navigate, useNavigate, useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
// assets
import emptyIssueDark from "@/app/assets/empty-state/search/issues-dark.webp?url";
import emptyIssueLight from "@/app/assets/empty-state/search/issues-light.webp?url";
// components
import { EmptyState } from "@/components/common/empty-state";
import { LogoSpinner } from "@/components/common/logo-spinner";
// hooks
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
// types
import type { Route } from "./+types/page";

export default function IssueDetailsPage({ params }: Route.ComponentProps) {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const navigate = useNavigate();
  const address = useQuery(api.navigation.address.resolveTaskId, {
    workspaceId: session.workspace._id,
    projectId: params.projectId,
    taskId: params.issueId,
  });
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  if (address) {
    const destination =
      address.kind === "task"
        ? `/${address.workspace.slug}/browse/${address.workItem}/`
        : `/${address.workspace.slug}/projects/${address.project._id}/intake/?currentTab=${address.intake.status === "pending" || address.intake.status === "snoozed" ? "open" : "closed"}&inboxIssueId=${address.intake.taskId}`;
    return <Navigate replace to={destination} />;
  }
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <div className="flex size-full items-center justify-center" aria-busy={address === undefined}>
        {address === undefined ? (
          <LogoSpinner />
        ) : (
          <EmptyState
            image={resolvedTheme === "dark" ? emptyIssueDark : emptyIssueLight}
            title={t("issue.empty_state.issue_detail.title")}
            description={t("issue.empty_state.issue_detail.description")}
            primaryButton={{
              text: t("issue.empty_state.issue_detail.primary_button.text"),
              onClick: () => navigate(`/${session.workspace.slug}/projects/${params.projectId}/issues/`),
            }}
          />
        )}
      </div>
    </PreservedWorkspaceShell>
  );
}
