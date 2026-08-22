/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { TasksRoot } from "@/components/summon/tasks";
import type { Route } from "./+types/page";

export default function SummonTasksPage({ params }: Route.ComponentProps) {
  const workspaceSlug = params.workspaceSlug;
  return <TasksRoot workspaceSlug={workspaceSlug} />;
}
