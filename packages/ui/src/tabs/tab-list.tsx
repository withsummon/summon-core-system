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
    <Primitive.List
      className={cn(
        "flex w-full min-w-fit items-center justify-between gap-1.5 rounded-md bg-layer-1 p-0.5 text-13",
        tabListClassName
      )}
    >
      {tabs.map((tab) => (
        <Primitive.Trigger
          value={tab.key}
          className={cn(
            "flex w-full min-w-fit cursor-pointer items-center justify-center rounded-sm p-1 font-medium text-primary transition-colors duration-150 motion-reduce:transition-none",
            "data-[selected]:shadow-sm hover:bg-layer-transparent-hover disabled:cursor-not-allowed disabled:text-placeholder data-[selected]:bg-layer-transparent-active data-[selected]:text-primary",
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
