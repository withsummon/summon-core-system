/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Navigate } from "react-router";
import { getWorkspaceHomePath } from "@plane/constants";

import type { Route } from "./+types/page";

export default function WorkspaceRootPage({ params }: Route.ComponentProps) {
  return <Navigate to={getWorkspaceHomePath(params.workspaceSlug)} replace />;
}
