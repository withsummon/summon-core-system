/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import type { FunctionArgs } from "convex/server";
import { TwitterPicker } from "react-color";
import type { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Popover, Input, TextArea } from "@plane/ui";

type Props = {
  data: FunctionArgs<typeof api.tasks.states.save>["data"];
  onChange: (data: FunctionArgs<typeof api.tasks.states.save>["data"]) => void;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
  disabled: boolean;
  pending: boolean;
  error: string;
};
export function StateForm({ data, onChange, onSubmit, onCancel, disabled, pending, error }: Props) {
  const name = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    name.current?.focus();
  }, []);
  return (
    <form
      className="space-y-2 rounded-sm bg-surface-1 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <fieldset disabled={disabled} className="flex w-full min-w-0 gap-2">
        <div className="mt-2 shrink-0">
          <Popover
            disabled={disabled}
            button={
              <span className="block size-5 rounded-sm" style={{ backgroundColor: data.color }}>
                <span className="sr-only">State color</span>
              </span>
            }
            panelClassName="mt-4 -ml-3"
          >
            <TwitterPicker color={data.color} onChange={(value) => onChange({ ...data, color: value.hex })} />
          </Popover>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            ref={name}
            type="text"
            aria-label="State name"
            placeholder="Name"
            value={data.name}
            required
            maxLength={255}
            onChange={(event) => onChange({ ...data, name: event.target.value })}
            className="w-full"
          />
          <TextArea
            aria-label="State description"
            placeholder="Describe this state for your members."
            value={data.description}
            maxLength={10000}
            onChange={(event) => onChange({ ...data, description: event.target.value })}
            className="min-h-14 w-full resize-none text-13"
          />
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="ml-7 text-13 text-danger-primary">
          {error}
        </p>
      )}
      <div className="ml-7 flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" size="lg" disabled={disabled} loading={pending}>
          Save
        </Button>
        <Button type="button" variant="secondary" size="lg" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
