/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cn } from "@plane/utils";
import type { ProjectState } from "../root";
export function StateMarksAsDefault({
  state,
  disabled,
  onDefault,
}: {
  state: ProjectState;
  disabled: boolean;
  onDefault: (stateId: ProjectState["_id"]) => Promise<boolean>;
}) {
  return (
    <button
      type="button"
      className={cn(
        "text-11 whitespace-nowrap",
        state.isDefault ? "text-tertiary" : "text-secondary hover:text-primary"
      )}
      disabled={state.isDefault || disabled}
      onClick={() => void onDefault(state._id)}
    >
      {state.isDefault ? "Default" : "Mark as default"}
    </button>
  );
}
