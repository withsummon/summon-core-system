/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Button } from "@plane/propel/button";
import { RecentStickyIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header } from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
export function StickyHeaderView({
  search,
  create,
  creatingSticky,
}: {
  search: React.ReactNode;
  create: () => void;
  creatingSticky: boolean;
}) {
  return (
    <>
      <Header>
        <Header.LeftItem>
          <div className="flex items-center gap-2.5">
            <Breadcrumbs>
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink
                    label={`Stickies`}
                    icon={<RecentStickyIcon className="size-5 rotate-90 text-secondary" />}
                  />
                }
              />
            </Breadcrumbs>
          </div>
        </Header.LeftItem>

        <Header.RightItem>
          {search}
          <Button variant="primary" size="lg" onClick={create} loading={creatingSticky}>
            Add sticky
          </Button>
        </Header.RightItem>
      </Header>
    </>
  );
}
