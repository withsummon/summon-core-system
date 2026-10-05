/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet, useNavigate, useOutletContext, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { ArchiveIcon, WorkItemsIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header, Row } from "@plane/ui";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";

export default function ProjectArchiveIssuesLayout() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const commands = useStickiesCommands();
  const address = useQuery(
    api.navigation.address.resolveProjectId,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      {!address ? (
        <p role="status" className="p-6">
          Loading archived work items…
        </p>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <Row className="z-[18] flex h-11 shrink-0 items-center gap-2 border-b border-subtle bg-surface-1">
            <Header>
              <Header.LeftItem>
                <Breadcrumbs onBack={() => navigate(-1)}>
                  <Breadcrumbs.Item
                    component={
                      <BreadcrumbLink
                        label={address.project.name}
                        href={`/${address.workspace.slug}/projects/${address.project._id}/issues/`}
                      />
                    }
                  />
                  <Breadcrumbs.Item
                    component={
                      <BreadcrumbLink
                        label="Archives"
                        href={`/${address.workspace.slug}/projects/${address.project._id}/archives/issues/`}
                        icon={<ArchiveIcon className="size-4 text-tertiary" />}
                      />
                    }
                  />
                  <Breadcrumbs.Item
                    component={
                      <BreadcrumbLink
                        label="Work items"
                        icon={<WorkItemsIcon className="size-4 text-tertiary" />}
                        isLast
                      />
                    }
                    isLast
                  />
                </Breadcrumbs>
              </Header.LeftItem>
            </Header>
          </Row>
          <ContentWrapper>
            <Outlet context={address} />
          </ContentWrapper>
        </div>
      )}
    </PreservedWorkspaceShell>
  );
}
