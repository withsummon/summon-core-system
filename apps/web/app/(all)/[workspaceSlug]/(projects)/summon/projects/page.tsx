/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ProjectsDirectoryRoot } from "@/components/summon/projects";
import type { Route } from "./+types/page";

export default function SummonProjectsPage({ params }: Route.ComponentProps) {
  const workspaceSlug = params.workspaceSlug;
  return <ProjectsDirectoryRoot workspaceSlug={workspaceSlug} />;
}
