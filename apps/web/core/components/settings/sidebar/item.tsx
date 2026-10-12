/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
// plane imports
import { cn } from "@plane/utils";
import type { LucideIcon } from "lucide-react";
import type { ISvgIcons } from "@plane/propel/icons";

type Props = {
  isActive: boolean;
  label: string;
} & ({ as: "button"; onClick: () => void } | { as: "link"; href: string }) &
  (
    | {
        icon: LucideIcon | React.FC<ISvgIcons>;
      }
    | { iconNode: React.ReactElement }
  );

/** Settings links arrive with and without a trailing slash, so compare both sides without it. */
export function isSettingsPathActive(pathname: string, href: string, exact = false) {
  const path = pathname.replace(/\/+$/, "");
  const target = href.replace(/\/+$/, "");
  return exact ? path === target : path === target || path.startsWith(`${target}/`);
}

export function SettingsSidebarItem(props: Props) {
  const { as, isActive, label } = props;
  // common class
  const className = cn(
    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-body-sm-medium transition-colors duration-150",
    {
      "bg-accent-subtle font-semibold text-accent-primary [&_svg]:text-accent-primary": isActive,
      "text-secondary hover:bg-layer-transparent-hover hover:text-primary [&_svg]:text-tertiary": !isActive,
    }
  );
  // common content
  const content = (
    <>
      {"icon" in props ? (
        <span className="grid size-4 shrink-0 place-items-center">{<props.icon className="size-3.5" />}</span>
      ) : (
        props.iconNode
      )}
      <span className="truncate">{label}</span>
    </>
  );

  if (as === "button") {
    return (
      <button type="button" className={className} onClick={props.onClick}>
        {content}
      </button>
    );
  }

  return (
    <Link className={className} href={props.href} aria-current={isActive ? "page" : undefined}>
      {content}
    </Link>
  );
}
