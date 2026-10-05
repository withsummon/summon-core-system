/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { Loader } from "@plane/ui";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import ActiveProjectItem from "./active-project-item";
export default function ActiveProjects({
  projects,
  isLoading,
}: {
  projects?: (FunctionReturnType<typeof api.reporting.analytics.projects>["contribution"][number] & {
    total: number;
    completed: number;
  })[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <AnalyticsSectionWrapper title={t("workspace_analytics.active_projects")} className="md:col-span-2">
      <div className="flex h-[350px] flex-col gap-4 overflow-auto">
        {isLoading
          ? Array.from({ length: 5 }, (_, i) => <Loader.Item key={i} height="40px" width="100%" />)
          : projects?.map((project) => <ActiveProjectItem key={project.id} project={project} />)}
      </div>
    </AnalyticsSectionWrapper>
  );
}
