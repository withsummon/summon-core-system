/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { ProjectLogo } from "@/components/common/project-logo";
// store
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
// local imports
import { NavbarControls } from "./controls";

type Props = {
  publishSettings: FunctionReturnType<typeof api.publicSharing.index.settings>;
};

export function IssuesNavbarRoot(props: Props) {
  const { publishSettings } = props;
  // hooks
  const { project } = publishSettings;

  return (
    <div className="relative flex w-full items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5">
      {/* project detail */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center">
          <ProjectLogo logo={project.logoProps} className="text-16" />
        </span>
        <div className="min-w-0 truncate text-16 font-medium">{project.name}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <NavbarControls publishSettings={publishSettings} />
      </div>
    </div>
  );
}
