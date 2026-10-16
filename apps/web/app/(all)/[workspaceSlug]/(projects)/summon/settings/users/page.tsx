/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { SummonUsersRoot } from "@/components/summon/settings/users-root";
import type { Route } from "./+types/page";

export default function SummonUsersPage({ params }: Route.ComponentProps) {
  return <SummonUsersRoot workspaceSlug={params.workspaceSlug} />;
}
