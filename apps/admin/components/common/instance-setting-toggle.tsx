/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
// plane internal packages
import { ToggleSwitch } from "@plane/ui";
import { cn } from "@plane/utils";

type Props = {
  title: ReactNode;
  description: ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
};

/** Titled row with a switch for a single on/off instance configuration. */
export function InstanceSettingToggle(props: Props) {
  const { title, description, value, onChange, disabled } = props;
  return (
    <div className="flex w-full items-center gap-14 rounded-sm">
      <div className="flex grow items-center gap-4">
        <div className="grow">
          <div className="pb-1 text-16 font-medium">{title}</div>
          <div className="text-11 leading-5 font-regular text-tertiary">{description}</div>
        </div>
      </div>
      <div className={cn("shrink-0 pr-4", disabled && "opacity-70")}>
        <div className="flex items-center gap-4">
          <ToggleSwitch value={value} onChange={() => onChange(!value)} size="sm" disabled={disabled} />
        </div>
      </div>
    </div>
  );
}
