/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { Popover } from "@plane/propel/popover";
import { Button } from "@plane/propel/button";
import type { TPlacement } from "@plane/propel/utils";

type Props = { children: ReactNode; title?: string; placement?: TPlacement };
export function FiltersDropdown({ children, title = "Dropdown", placement = "bottom-start" }: Props) {
  return (
    <Popover>
      <Popover.Button render={<Button variant="secondary" />}>{title}</Popover.Button>
      <Popover.Panel
        placement={placement}
        positionerClassName="z-50"
        className="overflow-hidden rounded-md border border-subtle bg-surface-1 shadow-raised-200"
      >
        <div className="flex max-h-[min(37.5rem,var(--available-height))] w-[18.75rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden">
          {children}
        </div>
      </Popover.Panel>
    </Popover>
  );
}
