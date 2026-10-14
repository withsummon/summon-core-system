/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
// components
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProjectsBaseHeader } from "@/components/project/header";
import { ProjectsListMobileHeader } from "@/components/projects/mobile-header";

/** Shell for the workspace projects list and project archives routes. */
export function ProjectsListLayout() {
  return (
    <>
      <AppHeader header={<ProjectsBaseHeader />} mobileHeader={<ProjectsListMobileHeader />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </>
  );
}
