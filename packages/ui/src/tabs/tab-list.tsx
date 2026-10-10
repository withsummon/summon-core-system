/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Tabs as Primitive } from "@plane/propel/tabs";
import type { LucideProps } from "lucide-react";
import type { FC } from "react";
import React from "react";
// helpers
import { cn } from "../utils";

export type TabListItem = {
  key: string;
  icon?: FC<LucideProps>;
  label?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
};

type TTabListProps = {
  tabs: TabListItem[];
  tabListClassName?: string;
  tabClassName?: string;
  size?: "sm" | "md" | "lg";
  selectedTab?: string;
  autoWrap?: boolean;
  onTabChange?: (key: string) => void;
};

export function TabList({ autoWrap = true, ...props }: TTabListProps) {
  return autoWrap ? (
    <Primitive
      value={props.selectedTab}
      defaultValue={props.tabs[0]?.key}
      onValueChange={(value) => props.onTabChange?.(String(value))}
    >
      <TabListInner {...props} />
    </Primitive>
  ) : (
    <TabListInner {...props} />
  );
}

function TabListInner({ tabs, tabListClassName, tabClassName, size = "md" }: TTabListProps) {
  return (
    <Primitive.List className={cn("min-w-fit", tabListClassName)}>
      {tabs.map((tab) => (
        <Primitive.Trigger
          value={tab.key}
          className={cn(
            "w-full rounded-sm",
            {
              "text-11": size === "sm",
              "text-13": size === "md",
              "text-14": size === "lg",
            },
            tabClassName
          )}
          key={tab.key}
          onClick={() => {
            if (!tab.disabled) {
              tab.onClick?.();
            }
          }}
          disabled={tab.disabled}
        >
          {tab.icon && (
            <tab.icon className={cn({ "size-3": size === "sm", "size-4": size === "md", "size-5": size === "lg" })} />
          )}
          {tab.label}
        </Primitive.Trigger>
      ))}
    </Primitive.List>
  );
}
