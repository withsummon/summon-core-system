/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AnalyticsScope } from "../../analytics-wrapper";
import { WorkItems } from "../root";
export function WorkItemsModalMainContent({
  scope,
  generation,
  workspaceSlug,
  fullScreen,
}: {
  scope: AnalyticsScope;
  generation: number;
  workspaceSlug: string;
  fullScreen: boolean;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <WorkItems
        key={JSON.stringify(scope)}
        scope={scope}
        generation={generation}
        workspaceSlug={workspaceSlug}
        peekView={!fullScreen}
      />
    </div>
  );
}
