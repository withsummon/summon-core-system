/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Tabs as Primitive } from "@plane/propel/tabs";
import React, { useEffect, useState } from "react";
// helpers
import { useLocalStorage } from "@plane/hooks";
import { cn } from "../utils";
// types
import type { TabListItem } from "./tab-list";
import { TabList } from "./tab-list";

export type TabContent = {
  content: React.ReactNode;
};

export type TabItem = TabListItem & TabContent;

type TTabsProps = {
  tabs: TabItem[];
  storageKey?: string;
  actions?: React.ReactNode;
  defaultTab?: string;
  containerClassName?: string;
  tabListContainerClassName?: string;
  tabListClassName?: string;
  tabClassName?: string;
  tabPanelClassName?: string;
  size?: "sm" | "md" | "lg";
  storeInLocalStorage?: boolean;
};

export function Tabs(props: TTabsProps) {
  const {
    tabs,
    storageKey,
    actions,
    defaultTab = tabs[0]?.key,
    containerClassName = "",
    tabListContainerClassName = "",
    tabListClassName = "",
    tabClassName = "",
    tabPanelClassName = "",
    size = "md",
    storeInLocalStorage = true,
  } = props;
  // local storage
  const { storedValue, setValue } = useLocalStorage(
    storeInLocalStorage && storageKey ? `tab-${storageKey}` : `tab-${tabs[0]?.key}`,
    defaultTab
  );
  // state
  const [selectedTab, setSelectedTab] = useState(storedValue ?? defaultTab);

  useEffect(() => {
    if (storeInLocalStorage) {
      setValue(selectedTab);
    }
  }, [selectedTab, setValue, storeInLocalStorage, storageKey]);

  const handleTabChange = (key: string) => {
    setSelectedTab(key);
  };

  return (
    <div className="flex h-full w-full flex-col">
      <Primitive value={selectedTab} onValueChange={(value) => handleTabChange(String(value))}>
        <div className={cn("flex h-full w-full flex-col gap-2", containerClassName)}>
          <div className={cn("flex w-full items-center gap-4", tabListContainerClassName)}>
            <TabList
              autoWrap={false}
              tabs={tabs}
              tabListClassName={tabListClassName}
              tabClassName={tabClassName}
              size={size}
              onTabChange={handleTabChange}
            />
            {actions && <div className="flex-grow">{actions}</div>}
          </div>
          <>
            {tabs.map((tab) => (
              <Primitive.Content
                key={tab.key}
                value={tab.key}
                className={cn("relative outline-none", tabPanelClassName)}
              >
                {tab.content}
              </Primitive.Content>
            ))}
          </>
        </div>
      </Primitive>
    </div>
  );
}
