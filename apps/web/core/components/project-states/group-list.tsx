/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ComponentProps } from "react";
import { statusOptions } from "@/components/convex-core/tasks/options";
import { GroupItem } from "./group-item";

type Props = Omit<ComponentProps<typeof GroupItem>, "status" | "expanded" | "onToggle">;
export function GroupList(props: Props) {
  const [collapsed, setCollapsed] = useState<(typeof statusOptions)[number]["value"][]>([]);
  return (
    <div className="space-y-5">
      {statusOptions.map(({ value }) => (
        <GroupItem
          key={value}
          {...props}
          status={value}
          expanded={!collapsed.includes(value)}
          onToggle={() =>
            setCollapsed((current) =>
              current.includes(value) ? current.filter((status) => status !== value) : [...current, value]
            )
          }
        />
      ))}
    </div>
  );
}
