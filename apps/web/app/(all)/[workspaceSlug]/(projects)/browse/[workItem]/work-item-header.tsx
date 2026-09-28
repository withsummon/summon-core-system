/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ComponentProps } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "@plane/i18n";
import { Breadcrumbs, Header } from "@plane/ui";
import { CopyLinkIcon, WorkItemsIcon } from "@plane/propel/icons";
import { IconButton } from "@plane/propel/icon-button";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { Menu } from "@plane/propel/menu";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { copyUrlToClipboard } from "@plane/utils";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { TaskLifecycle } from "@/components/convex-core/tasks/lifecycle";
import { TaskSubscription } from "@/components/convex-core/notifications/task-subscription";
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
  const { t } = useTranslation();
  const [copying, setCopying] = useState(false);
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
        <IconButton
          icon={CopyLinkIcon}
          variant="ghost"
          size="base"
          aria-label="Copy work item link"
          disabled={copying}
          onClick={async () => {
            setCopying(true);
            try {
              await copyUrlToClipboard(`/${address.workspace.slug}/browse/${address.workItem}/`);
              setToast({
                type: TOAST_TYPE.SUCCESS,
                title: t("common.link_copied"),
                message: t("common.copied_to_clipboard"),
              });
            } catch {
              setToast({ type: TOAST_TYPE.ERROR, title: t("toast.error") });
            } finally {
              setCopying(false);
            }
          }}
        />
        <TaskLifecycle task={address.task} disabled={disabled} lifecycle={lifecycle}>
          <Menu.MenuItem
            onClick={() =>
              window.open(`/${address.workspace.slug}/browse/${address.workItem}/`, "_blank", "noopener,noreferrer")
            }
          >
            Open in new tab
          </Menu.MenuItem>
        </TaskLifecycle>
      </Header.RightItem>
    </Header>
  );
}
