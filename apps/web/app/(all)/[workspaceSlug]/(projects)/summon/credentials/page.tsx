/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { SummonCredentialsRootView } from "@/components/summon/credentials";
import { useWorkspace } from "@/hooks/store/use-workspace";
import type { Route } from "./+types/page";

function SummonCredentialsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { currentWorkspace } = useWorkspace();

  return (
    <SummonCredentialsRootView
      workspaceSlug={workspaceSlug}
      workspaceName={currentWorkspace?.name}
    />
  );
}

export default observer(SummonCredentialsPage);
