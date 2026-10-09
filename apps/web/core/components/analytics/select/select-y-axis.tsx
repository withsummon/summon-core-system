/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CustomSelect } from "@plane/ui";
import { ProjectIcon } from "@plane/propel/icons";
export function SelectYAxis() {
  return (
    <CustomSelect
      value="count"
      ariaLabel="Chart measure"
      label={
        <span className="flex items-center gap-2">
          <ProjectIcon className="size-3" />
          Work item count
        </span>
      }
      onChange={() => {}}
    >
      <CustomSelect.Option value="count">Work item count</CustomSelect.Option>
    </CustomSelect>
  );
}
