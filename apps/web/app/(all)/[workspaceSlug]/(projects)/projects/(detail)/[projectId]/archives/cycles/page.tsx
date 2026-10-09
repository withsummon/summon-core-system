/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext, useNavigate } from "react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { ProjectCycles } from "@/components/convex-core/cycles/list";
export default function ProjectArchivedCyclesPage() {
  const address = useOutletContext<FunctionReturnType<typeof api.navigation.address.resolveProjectId>>();
  const navigate = useNavigate();
  return (
    <ProjectCycles
      address={address}
      view="archived"
      onCreate={() => navigate(`/${address.workspace.slug}/projects/${address.project._id}/cycles/?createCycle=1`)}
    />
  );
}
