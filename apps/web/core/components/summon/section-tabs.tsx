/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { SelectableIcon } from "@plane/propel/icons";
import type { TSelectableIcon } from "@plane/propel/icons";
import { Tabs } from "@plane/propel/tabs";

export type TSectionTab<T extends string> = {
  value: T;
  label: string;
  icon: TSelectableIcon;
  /** Route or `#section` anchor; omit for tabs that only switch local state. */
  href?: string;
};

/**
 * Underlined section tabs with a sliding indicator and icons that fill when selected.
 * Link tabs stay real anchors (Base UI renders them with `nativeButton={false}`).
 */
export function SectionTabs<T extends string>(props: {
  items: TSectionTab<T>[];
  value: T;
  onValueChange?: (value: T) => void;
  label: string;
  className?: string;
}) {
  const { items, value, onValueChange, label, className } = props;
  return (
    <Tabs variant="underline" value={value} onValueChange={(next) => onValueChange?.(next as T)} className="h-auto">
      <Tabs.List aria-label={label} className={className}>
        {items.map((item) => (
          <Tabs.Trigger
            key={item.value}
            value={item.value}
            {...(item.href
              ? {
                  nativeButton: false,
                  render: (renderProps: React.ComponentProps<"a">) =>
                    item.href?.startsWith("#") ? (
                      <a {...renderProps} href={item.href}>
                        {renderProps.children}
                      </a>
                    ) : (
                      <Link {...renderProps} href={item.href ?? ""} />
                    ),
                }
              : {})}
          >
            <SelectableIcon icon={item.icon} />
            {item.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
