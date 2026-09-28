/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { START_OF_THE_WEEK_OPTIONS } from "@plane/constants";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { SelectPrimitive as Select } from "@plane/propel/select";
import { CheckIcon, ChevronDownIcon } from "@plane/propel/icons";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { SettingsControlItem } from "@/components/settings/control-item";

export function StartOfWeekPreference({
  option,
  profile,
}: {
  option: { title: string; description: string };
  profile: FunctionReturnType<typeof api.identity.profile.get>;
}) {
  const save = useMutation(api.identity.preferences.save);
  const [pending, setPending] = useState(false);

  const handleStartOfWeekChange = async (startOfWeek: typeof profile.preferences.startOfWeek) => {
    setPending(true);
    try {
      await save({ expectedRevision: profile.revision, preferences: { ...profile.preferences, startOfWeek } });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success", message: "First day of the week updated successfully" });
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Update failed", message: mutationMessage(error) });
    } finally {
      setPending(false);
    }
  };

  return (
    <SettingsControlItem
      title={option.title}
      description={option.description}
      control={
        <Select.Root<typeof profile.preferences.startOfWeek>
          value={profile.preferences.startOfWeek}
          onValueChange={(day) => {
            if (day !== null) void handleStartOfWeekChange(day);
          }}
          disabled={pending}
        >
          <Select.Trigger
            aria-label={option.title}
            className="flex items-center justify-between gap-1 rounded border border-subtle-1 px-3 py-2 text-13 outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40 disabled:opacity-50"
          >
            <Select.Value />
            <ChevronDownIcon className="size-3" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner align="end" sideOffset={4} alignItemWithTrigger={false} className="z-120">
              <Select.Popup className="max-h-60 min-w-48 overflow-y-auto rounded-md border border-subtle-1 bg-surface-1 p-2 text-11 shadow-raised-200 outline-none">
                {START_OF_THE_WEEK_OPTIONS.map((day) => (
                  <Select.Item
                    key={day.value}
                    value={day.value}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-1 py-1.5 text-secondary outline-none data-[highlighted]:bg-layer-transparent-hover"
                  >
                    <Select.ItemText>{day.label}</Select.ItemText>
                    <Select.ItemIndicator>
                      <CheckIcon className="size-3.5" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      }
    />
  );
}
