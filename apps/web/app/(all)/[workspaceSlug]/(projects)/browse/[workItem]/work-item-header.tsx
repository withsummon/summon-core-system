/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { useNavigate } from "react-router";
import { Breadcrumbs, Header } from "@plane/ui";
import { WorkItemsIcon } from "@plane/propel/icons";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { TaskLifecycle } from "@/components/convex-core/tasks/lifecycle";
import { TaskSubscription } from "@/components/convex-core/notifications/task-subscription";
import { CopyWorkItemLink } from "@/components/convex-core/tasks/task-detail";
import type { BrowseAddress } from "./layout";

export function WorkItemDetailsHeader({
  address,
  disabled,
  lifecycle,
}: {
  address: Extract<BrowseAddress, { kind: "task" }>;
  disabled: boolean;
  lifecycle: ComponentProps<typeof TaskLifecycle>["lifecycle"];
}) {
  const navigate = useNavigate();
  const projectHref = `/${address.workspace.slug}/projects/${address.project._id}/issues/`;
  return (
    <Header className="h-11 shrink-0 border-b border-subtle">
      <Header.LeftItem>
        <Breadcrumbs onBack={() => navigate(-1)}>
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={address.project.name}
                href={projectHref}
                icon={<Logo logo={address.projectLogo ?? undefined} size={16} />}
              />
            }
          />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label="Work Items"
                href={projectHref}
                icon={<WorkItemsIcon className="size-4 text-tertiary" />}
              />
            }
          />
          <Breadcrumbs.Item component={<BreadcrumbLink label={address.workItem} />} />
        </Breadcrumbs>
      </Header.LeftItem>
      <Header.RightItem>
        <TaskSubscription taskId={address.task._id} />
        <CopyWorkItemLink href={`/${address.workspace.slug}/browse/${address.workItem}/`} />
        <TaskLifecycle
          task={address.task}
          href={`/${address.workspace.slug}/browse/${address.workItem}/`}
          disabled={disabled}
          lifecycle={lifecycle}
        />
      </Header.RightItem>
    </Header>
  );
}
