/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { SummonSettingsRootView } from "@/components/summon/settings";
import { useWorkspace } from "@/hooks/store/use-workspace";
import type { Route } from "./+types/page";

function SummonSettingsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { currentWorkspace } = useWorkspace();

  return (
    <SummonSettingsRootView
      workspaceSlug={workspaceSlug}
      workspaceName={currentWorkspace?.name}
    />
  );
}

export default observer(SummonSettingsPage);
