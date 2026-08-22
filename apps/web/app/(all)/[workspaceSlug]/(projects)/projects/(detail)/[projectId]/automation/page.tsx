/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useProject } from "@/hooks/store/use-project";
import { AutomationRootView } from "@/components/automation";
import type { Route } from "./+types/page";

function ProjectAutomationPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { getProjectById } = useProject();

  const project = getProjectById(projectId);

  return (
    <AutomationRootView
      workspaceSlug={workspaceSlug}
      projectId={projectId}
      projectName={project?.name}
    />
  );
}

export default observer(ProjectAutomationPage);
