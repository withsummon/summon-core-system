/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { getButtonStyling } from "@plane/propel/button";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { ChevronDownIcon, ProjectIcon } from "@plane/propel/icons";
import { CustomSearchSelect } from "@plane/ui";
import { cn } from "@plane/utils";
type Project = FunctionReturnType<typeof api.reporting.analytics.projects>["contribution"][number];
export function ProjectSelect({
  value,
  onChange,
  projects,
}: {
  value: Project["id"][];
  onChange: (value: Project["id"][]) => void;
  projects: Project[];
}) {
  const options = projects.map((project) => ({
    value: project.id,
    query: `${project.name} ${project.identifier}`,
    content: (
      <span className="flex max-w-[300px] items-center gap-2">
        {project.logo ? <Logo logo={project.logo} size={16} /> : <ProjectIcon className="size-4" />}
        <span className="truncate">{project.name}</span>
      </span>
    ),
  }));
  return (
    <CustomSearchSelect
      value={value}
      onChange={(selected: string[]) =>
        onChange(projects.filter((project) => selected.includes(project.id)).map((project) => project.id))
      }
      options={options}
      multiple
      className="border-none p-0"
      customButton={
        <span className={cn(getButtonStyling("secondary", "lg"), "max-w-[300px] gap-2")}>
          <ProjectIcon className="size-4" />
          <span className="truncate">
            {value.length > 3
              ? "3+ projects"
              : value.length
                ? projects
                    .filter((project) => value.includes(project.id))
                    .map((project) => project.name)
                    .join(", ")
                : "All projects"}
          </span>
          <ChevronDownIcon className="size-3" />
        </span>
      }
      customButtonClassName="border-none p-0 bg-transparent hover:bg-transparent w-auto h-auto"
    />
  );
}
