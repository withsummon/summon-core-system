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
import { CustomSelect } from "@plane/ui";
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

  const handleStartOfWeekChange = async (startOfWeek: number) => {
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
        <CustomSelect
          value={profile.preferences.startOfWeek}
          label={START_OF_THE_WEEK_OPTIONS.find((day) => day.value === profile.preferences.startOfWeek)?.label}
          onChange={handleStartOfWeekChange}
          disabled={pending}
          buttonClassName="border border-subtle-1"
          input
          maxHeight="lg"
          placement="bottom-end"
        >
          {START_OF_THE_WEEK_OPTIONS.map((day) => (
            <CustomSelect.Option key={day.value} value={day.value}>
              {day.label}
            </CustomSelect.Option>
          ))}
        </CustomSelect>
      }
    />
  );
}
