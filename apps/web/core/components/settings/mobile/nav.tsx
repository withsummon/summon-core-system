/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { ChevronRightIcon } from "@plane/propel/icons";
import { Popover } from "@plane/propel/popover";

type Props = {
  children: (close: () => void) => ReactNode;
  activePath: string;
};

export function SettingsMobileNav({ children, activePath }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-4 border-b border-subtle px-page-x py-3 md:hidden">
      <Popover open={open} onOpenChange={setOpen}>
        <Popover.Button
          aria-label="Settings sections"
          className="rounded-md border border-subtle bg-layer-1 p-2 text-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
        >
          <Menu className="size-4" />
        </Popover.Button>
        <Popover.Panel
          aria-label="Settings sections"
          align="start"
          positionerClassName="z-110 md:hidden"
          className="max-h-[min(25rem,var(--available-height))] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-subtle bg-surface-1 shadow-raised-200"
        >
          {children(() => setOpen(false))}
        </Popover.Panel>
      </Popover>
      {/* path */}
      <div className="flex items-center gap-2">
        <ChevronRightIcon className="size-4 text-tertiary" />
        <span className="text-13 font-medium text-secondary">{t(activePath)}</span>
      </div>
    </div>
  );
}
