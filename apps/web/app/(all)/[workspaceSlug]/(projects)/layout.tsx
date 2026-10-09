/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Outlet } from "react-router";
import { WorkspaceProjectFrame } from "@/components/workspace/project-frame";
import { ProjectsAppPowerKProvider } from "@/components/power-k/projects-app-provider";
// plane web components
import { ProjectAppSidebar } from "./_sidebar";
import { ExtendedProjectSidebar } from "./extended-project-sidebar";

function WorkspaceLayout() {
  return (
    <>
      <ProjectsAppPowerKProvider />
      <WorkspaceProjectFrame
        sidebar={
          <>
            <ProjectAppSidebar />
            <ExtendedProjectSidebar />
          </>
        }
      >
        <Outlet />
      </WorkspaceProjectFrame>
    </>
  );
}

export default observer(WorkspaceLayout);
