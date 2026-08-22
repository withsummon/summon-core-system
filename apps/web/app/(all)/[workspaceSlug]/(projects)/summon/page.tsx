/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { HomeRoot } from "@/components/summon/home";
import type { Route } from "./+types/page";

function SummonOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  return <HomeRoot workspaceSlug={workspaceSlug} />;
}

export default observer(SummonOverviewPage);
