/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ResourcesRoot } from "@/components/summon/resources";
import type { Route } from "./+types/page";

export default function SummonResourcesPage({ params }: Route.ComponentProps) {
  const workspaceSlug = params.workspaceSlug;
  return <ResourcesRoot workspaceSlug={workspaceSlug} />;
}
