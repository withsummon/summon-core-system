/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Checkbox } from "@plane/ui";

const labels = {
  project: { label: "Projects", description: "Project created, updated, or deleted" },
  cycle: { label: "Cycles", description: "Cycle created, updated, or deleted" },
  issue: { label: "Work items", description: "Work item created, updated, deleted, added to a cycle or module" },
  module: { label: "Modules", description: "Module created, updated, or deleted" },
  issue_comment: { label: "Work item comments", description: "Comment posted, updated, or deleted" },
} satisfies Record<
  FunctionArgs<typeof api.webhooks.index.update>["input"]["events"][number],
  { label: string; description: string }
>;

type Props = {
  control: Control<FunctionArgs<typeof api.webhooks.index.update>["input"]>;
  events: FunctionReturnType<typeof api.webhooks.index.options>["events"];
};
export function WebhookIndividualEventOptions({ control, events }: Props) {
  return (
    <Controller
      control={control}
      name="events"
      render={({ field: { onChange, value } }) => (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 px-6 lg:grid-cols-2">
          {events.map((event) => (
            <div key={event}>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={event}
                  checked={value.includes(event)}
                  onCheckedChange={(checked) =>
                    onChange(checked ? [...value, event] : value.filter((selected) => selected !== event))
                  }
                />
                <label className="text-13" htmlFor={event}>
                  {labels[event].label}
                </label>
              </div>
              <p className="mt-0.5 ml-6 text-11 text-tertiary">{labels[event].description}</p>
            </div>
          ))}
        </div>
      )}
    />
  );
}
