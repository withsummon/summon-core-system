/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";

type Props = {
  workspaceSlug: string;
  project: { id: string; name: string };
};

/** `relative` keeps the badge clickable above a row's stretched title link. */
export const PROJECT_BADGE_CLASSNAME =
  "relative max-w-48 truncate rounded border border-subtle px-2 py-0.5 text-12 hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid";

/** Links a row to its project. */
export function SummonProjectBadge({ workspaceSlug, project }: Props) {
  return (
    <Link
      href={`/${workspaceSlug}/summon/projects/${project.id}/`}
      className={PROJECT_BADGE_CLASSNAME}
      title={project.name}
    >
      {project.name}
    </Link>
  );
}
