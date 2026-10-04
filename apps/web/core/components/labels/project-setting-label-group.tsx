/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { CollapsiblePrimitive } from "@plane/propel/collapsible";
import { ChevronDownIcon } from "@plane/propel/icons";
import { ProjectSettingLabelItem } from "./project-setting-label-item";

export function ProjectSettingLabelGroup(props: ComponentProps<typeof ProjectSettingLabelItem>) {
  const children = props.labels.filter((row) => row.parentId === props.label._id);
  return (
    <CollapsiblePrimitive.Root
      defaultOpen
      className="space-y-1"
      render={(rootProps, { open }) => (
        <div {...rootProps}>
          <ProjectSettingLabelItem {...props}>
            <CollapsiblePrimitive.Trigger
              aria-label={`${open ? "Collapse" : "Expand"} ${props.label.name}`}
              className="shrink-0 pr-2"
            >
              <ChevronDownIcon className={`size-4 text-placeholder ${open ? "" : "-rotate-90"}`} />
            </CollapsiblePrimitive.Trigger>
          </ProjectSettingLabelItem>
          <CollapsiblePrimitive.Panel className="space-y-1 pl-6">
            {children.map((label, index) => {
              const childProps = { ...props, label, isChild: true, isLastChild: index === children.length - 1 };
              return props.labels.some((row) => row.parentId === label._id) ? (
                <ProjectSettingLabelGroup key={label._id} {...childProps} />
              ) : (
                <ProjectSettingLabelItem key={label._id} {...childProps} />
              );
            })}
          </CollapsiblePrimitive.Panel>
        </div>
      )}
    />
  );
}
