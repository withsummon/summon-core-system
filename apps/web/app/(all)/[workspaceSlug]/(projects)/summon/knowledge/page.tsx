/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { observer } from "mobx-react";
import { KnowledgeRootView } from "@/components/knowledge";
import { useWorkspace } from "@/hooks/store/use-workspace";
import type { Route } from "./+types/page";

function SummonKnowledgePage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { currentWorkspace } = useWorkspace();

  return <KnowledgeRootView workspaceSlug={workspaceSlug} workspaceName={currentWorkspace?.name} />;
}

export default observer(SummonKnowledgePage);
