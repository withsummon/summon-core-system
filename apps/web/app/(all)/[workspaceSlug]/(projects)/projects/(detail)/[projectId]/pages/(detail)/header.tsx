/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import type { CollaborationState } from "@plane/editor";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { PageIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header } from "@plane/ui";
import { getPageName } from "@plane/utils";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { DocumentActions } from "@/components/convex-core/documents/documents";

export function PageDetailsHeader({
  address,
  resolved,
  state,
  actions,
  isSaving,
}: {
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
  resolved: NonNullable<FunctionReturnType<typeof api.documents.index.resolve>>;
  state: CollaborationState;
  actions: ReactNode;
  isSaving: boolean;
}) {
  const { document, context } = resolved;
  return (
    <div className="shrink-0 border-b border-subtle">
      <Header>
        <Header.LeftItem>
          <Breadcrumbs>
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
                  label="Pages"
                  href={`/${address.workspace.slug}/projects/${address.project._id}/pages/`}
                  icon={<PageIcon className="size-4 text-tertiary" />}
                />
              }
            />
            <Breadcrumbs.Item
              component={
                <BreadcrumbLink
                  label={getPageName(document.name)}
                  icon={
                    context.logo ? (
                      <Logo logo={context.logo} size={16} type="lucide" />
                    ) : (
                      <PageIcon className="size-4 text-tertiary" />
                    )
                  }
                  isLast
                />
              }
              isLast
            />
          </Breadcrumbs>
        </Header.LeftItem>
        <Header.RightItem>
          {(isSaving || state.stage.kind !== "synced") && (
            <span role="status" className="text-12 text-secondary">
              {state.isServerDisconnected ? "Connection lost" : isSaving ? "Saving…" : "Connecting…"}
            </span>
          )}
          {document.archived && <span className="text-12 text-secondary">Archived</span>}
          {document.isLocked && <span className="text-12 text-secondary">Locked</span>}
          <DocumentActions
            document={document}
            canManage={context.canManage}
            workspaceSlug={address.workspace.slug}
            projectId={address.project._id}
            disabled={isSaving}
          >
            {actions}
          </DocumentActions>
        </Header.RightItem>
      </Header>
    </div>
  );
}
