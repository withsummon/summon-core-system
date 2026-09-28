/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Navigate, useNavigate, useOutletContext } from "react-router";
import { useTheme } from "next-themes";
import { useTranslation } from "@plane/i18n";
import { Loader } from "@plane/ui";
import emptyIssueDark from "@/app/assets/empty-state/search/issues-dark.webp?url";
import emptyIssueLight from "@/app/assets/empty-state/search/issues-light.webp?url";
import { EmptyState } from "@/components/common/empty-state";
import { PageHead } from "@/components/core/page-title";
import { TaskDetailContent } from "@/components/convex-core/tasks/task-detail";
import type { Route } from "./+types/page";
import type { BrowseSession } from "./layout";
import { WorkItemDetailsHeader } from "./work-item-header";

export default function IssueDetailsPage({ params }: Route.ComponentProps) {
  const { address, lifecycle } = useOutletContext<BrowseSession>();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  if (address === undefined)
    return (
      <Loader className="flex h-full gap-5 p-5">
        <div className="basis-2/3 space-y-2">
          <Loader.Item height="30px" width="40%" />
          <Loader.Item height="15px" width="60%" />
          <Loader.Item height="15px" width="60%" />
          <Loader.Item height="15px" width="40%" />
        </div>
        <div className="basis-1/3 space-y-3">
          <Loader.Item height="30px" />
          <Loader.Item height="30px" />
          <Loader.Item height="30px" />
          <Loader.Item height="30px" />
        </div>
      </Loader>
    );
  if (address === null)
    return (
      <EmptyState
        image={resolvedTheme === "dark" ? emptyIssueDark : emptyIssueLight}
        title={t("issue.empty_state.issue_detail.title")}
        description={t("issue.empty_state.issue_detail.description")}
        primaryButton={{
          text: t("issue.empty_state.issue_detail.primary_button.text"),
          onClick: () => navigate(`/${params.workspaceSlug}/workspace-views/all-issues/`),
        }}
      />
    );
  if (address.kind === "intake") {
    if (address.intake.status === "pending" || address.intake.status === "snoozed")
      return (
        <Navigate
          replace
          to={`/${address.workspace.slug}/projects/${address.project._id}/intake/?currentTab=open&inboxIssueId=${address.intake.taskId}`}
        />
      );
    return (
      <p role="alert" className="p-6">
        This submission is not an open Intake item.
      </p>
    );
  }
  return (
    <>
      <PageHead title={`${address.workItem} ${address.task.title}`} />
      <TaskDetailContent
        key={address.task._id}
        task={address.task}
        project={address.project}
        lifecyclePending={lifecycle.pending}
        header={(hasUnsavedText) => (
          <WorkItemDetailsHeader address={address} disabled={hasUnsavedText} lifecycle={lifecycle} />
        )}
      />
    </>
  );
}
