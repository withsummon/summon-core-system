/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane package imports
import { Logo } from "@plane/propel/emoji-icon-picker";
import { ProjectIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
// plane web hooks
import type { ComponentProps } from "react";
import type ActiveProjects from "./active-projects";

type Props = { project: NonNullable<ComponentProps<typeof ActiveProjects>["projects"]>[number] };

function CompletionPercentage({ percentage }: { percentage: number }) {
  const percentageColor =
    percentage > 50 ? "bg-success-subtle text-success-primary" : "bg-danger-subtle text-danger-primary";
  return (
    <div className={cn("flex items-center gap-2 rounded-sm p-1 text-11", percentageColor)}>
      <span>{percentage}%</span>
    </div>
  );
}

function ActiveProjectItem(props: Props) {
  const { project } = props;
  const projectDetails = project;
  const { completed: completed_issues, total: total_issues } = project;

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-layer-1">
          <span className="grid h-4 w-4 flex-shrink-0 place-items-center">
            {projectDetails.logo ? (
              <Logo logo={projectDetails.logo} size={16} />
            ) : (
              <span className="grid h-4 w-4 flex-shrink-0 place-items-center">
                <ProjectIcon className="h-4 w-4" />
              </span>
            )}
          </span>
        </div>
        <Tooltip tooltipContent={projectDetails.name} position="top-start">
          <p className="truncate text-13 font-medium">{projectDetails.name}</p>
        </Tooltip>
      </div>
      <CompletionPercentage
        percentage={completed_issues && total_issues ? Math.round((completed_issues / total_issues) * 100) : 0}
      />
    </div>
  );
}

export default ActiveProjectItem;
