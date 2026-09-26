/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import { CheckIcon } from "@plane/propel/icons";
import { cn } from "@plane/utils";

export type TStateOptionProps = {
  projectId: string | null | undefined;
  option: {
    value: string | undefined;
    query: string;
    content: React.ReactNode;
  };
  selectedValue: string | null | undefined;
  className?: string;
  filterAvailableStateIds?: boolean;
  isForWorkItemCreation?: boolean;
  alwaysAllowStateChange?: boolean;
};

export const StateOption = observer(function StateOption(props: TStateOptionProps) {
  const { option, className = "" } = props;

  return (
    <Combobox.Item
      key={option.value}
      value={option.value}
      className={({ highlighted: active, selected }) =>
        cn(`${className} ${active ? "bg-layer-transparent-hover" : ""} ${selected ? "text-primary" : "text-secondary"}`)
      }
      render={(itemProps, { selected }) => (
        <div {...itemProps}>
          {
            <>
              <span className="flex-grow truncate">{option.content}</span>
              {selected && <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />}
            </>
          }
        </div>
      )}
    ></Combobox.Item>
  );
});
