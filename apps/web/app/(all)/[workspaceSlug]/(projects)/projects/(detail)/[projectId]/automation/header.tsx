/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { Sparkles } from "lucide-react";
import { Breadcrumbs, Header } from "@plane/ui";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
export function ProjectAutomationHeader({
  address,
}: {
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
}) {
  return (
    <Header className="min-w-0">
      <Header.LeftItem className="min-w-0">
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={address.project.name}
                href={`/${address.workspace.slug}/projects/${address.project._id}/issues`}
              />
            }
          />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label="Automation"
                href={`/${address.workspace.slug}/projects/${address.project._id}/automation`}
                icon={<Sparkles className="text-blue-500 h-4 w-4" />}
              />
            }
            isLast
          />
        </Breadcrumbs>
      </Header.LeftItem>
    </Header>
  );
}
