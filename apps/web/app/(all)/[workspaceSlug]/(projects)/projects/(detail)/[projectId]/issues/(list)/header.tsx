/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useNavigate } from "react-router";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { WorkItemsIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header } from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";

type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;

export function ProjectIssuesHeader({ address, onCreate }: { address: Address; onCreate?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs onBack={() => navigate(-1)} className="flex-grow-0">
          <Breadcrumbs.Item component={<BreadcrumbLink label={address.project.name} />} />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label="Work Items"
                href={`/${address.workspace.slug}/projects/${address.project._id}/issues/`}
                icon={<WorkItemsIcon className="size-4 text-tertiary" />}
                isLast
              />
            }
            isLast
          />
        </Breadcrumbs>
      </Header.LeftItem>
      <Header.RightItem>
        {onCreate && (
          <Button size="lg" onClick={onCreate}>
            {t("issue.add.label")}
          </Button>
        )}
      </Header.RightItem>
    </Header>
  );
}
