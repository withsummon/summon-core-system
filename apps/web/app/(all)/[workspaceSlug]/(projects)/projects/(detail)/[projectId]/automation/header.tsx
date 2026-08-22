/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { Sparkles } from "lucide-react";
// plane ui
import { Breadcrumbs, Header } from "@plane/ui";
// helpers
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
// hooks
import { useProject } from "@/hooks/store/use-project";
// plane web imports
import { CommonProjectBreadcrumbs } from "@/components/breadcrumbs/common";

export const ProjectAutomationHeader = observer(function ProjectAutomationHeader() {
  const { workspaceSlug, projectId } = useParams();
  const { currentProjectDetails, loader } = useProject();

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs isLoading={loader === "init-loader"}>
          <CommonProjectBreadcrumbs
            workspaceSlug={workspaceSlug?.toString() ?? ""}
            projectId={projectId?.toString() ?? ""}
          />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label="Automation"
                href={`/${workspaceSlug}/projects/${currentProjectDetails?.id || projectId}/automation`}
                icon={<Sparkles className="text-blue-500 h-4 w-4" />}
                isLast
              />
            }
            isLast
          />
        </Breadcrumbs>
      </Header.LeftItem>
    </Header>
  );
});
