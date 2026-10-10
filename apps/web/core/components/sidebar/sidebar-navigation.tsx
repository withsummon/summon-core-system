/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cn } from "@plane/utils";

type TSidebarNavItem = {
  className?: string;
  isActive?: boolean;
  children?: React.ReactNode;
};

export function SidebarNavItem(props: TSidebarNavItem) {
  const { className, isActive, children } = props;
  return (
    <div
      data-active={isActive || undefined}
      className={cn(
        "group group/select relative flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-md px-2 py-1 transition-colors duration-150 outline-none",
        {
          "!bg-accent-subtle font-semibold text-accent-primary [&_svg]:text-accent-primary": isActive,
          "text-secondary hover:bg-layer-1 hover:text-primary active:bg-layer-1-hover [&_svg]:text-tertiary hover:[&_svg]:text-secondary":
            !isActive,
        },
        className
      )}
    >
      {children}
    </div>
  );
}
