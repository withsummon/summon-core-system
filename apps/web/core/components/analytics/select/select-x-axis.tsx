/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { CustomSelect } from "@plane/ui";
import { analyticsAxes } from "./analytics-params";
type Axis = FunctionArgs<typeof api.reporting.analytics.chart>["axis"];
export function SelectXAxis({
  value,
  onChange,
  excluded,
  allowNoValue,
  label,
}: {
  value: Axis | null;
  onChange: (value: Axis | null) => void;
  excluded: Axis | null;
  allowNoValue?: boolean;
  label: ReactNode;
}) {
  return (
    <CustomSelect
      value={value}
      label={label}
      ariaLabel={allowNoValue ? "Group by" : "Chart dimension"}
      onChange={onChange}
      maxHeight="lg"
    >
      {allowNoValue && <CustomSelect.Option value={null}>No value</CustomSelect.Option>}
      {Object.entries(analyticsAxes)
        .filter(([key]) => key !== excluded)
        .map(([key, name]) => (
          <CustomSelect.Option key={key} value={key}>
            {name}
          </CustomSelect.Option>
        ))}
    </CustomSelect>
  );
}
