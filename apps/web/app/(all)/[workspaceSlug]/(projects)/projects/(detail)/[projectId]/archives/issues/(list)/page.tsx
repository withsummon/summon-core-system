/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext } from "react-router";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { PageHead } from "@/components/core/page-title";
import { TaskRecoveryList } from "@/components/convex-core/tasks/lifecycle";

export default function ProjectArchivedIssuesPage() {
  const address = useOutletContext<FunctionReturnType<typeof api.navigation.address.resolveProjectId>>();
  return (
    <>
      <PageHead title={`${address.project.name} - Archived work items`} />
      <div className="relative flex h-full w-full flex-col overflow-auto">
        <TaskRecoveryList key={address.project._id} project={address.project} view="archived" />
      </div>
    </>
  );
}
