/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { ProjectSelect } from "./select/project";
export default function AnalyticsFilterActions(props: ComponentProps<typeof ProjectSelect>) {
  return (
    <div className="flex items-center justify-end gap-2">
      <ProjectSelect {...props} />
    </div>
  );
}
