/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ReportingRoot } from "@/components/summon/reports";
import type { Route } from "./+types/page";

export default function SummonReportsPage({ params }: Route.ComponentProps) {
  const workspaceSlug = params.workspaceSlug;
  return <ReportingRoot workspaceSlug={workspaceSlug} />;
}
