/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Link } from "react-router";
import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { EHeaderVariant, Header } from "@plane/ui";

export function ArchivedIssuesHeader({
  address,
  features,
  children,
}: {
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
  features: FunctionReturnType<typeof api.projects.features.get>["features"];
  children: ReactNode;
}) {
  const base = `/${address.workspace.slug}/projects/${address.project._id}/archives`;
  return (
    <Header variant={EHeaderVariant.SECONDARY} className="flex-wrap">
      <Header.LeftItem className="max-w-full flex-nowrap overflow-x-auto">
        <Link
          to={`${base}/issues`}
          aria-current="page"
          className="flex-shrink-0 border-b-2 border-accent-strong px-4 py-4 text-13 font-medium whitespace-nowrap text-accent-primary"
        >
          Work items
        </Link>
        {features.cycles && (
          <Link to={`${base}/cycles`} className="flex-shrink-0 px-4 py-4 text-13 font-medium text-tertiary">
            Cycles
          </Link>
        )}
        {features.modules && (
          <Link to={`${base}/modules`} className="flex-shrink-0 px-4 py-4 text-13 font-medium text-tertiary">
            Modules
          </Link>
        )}
      </Header.LeftItem>
      <Header.RightItem className="flex-wrap px-3 py-2">{children}</Header.RightItem>
    </Header>
  );
}
