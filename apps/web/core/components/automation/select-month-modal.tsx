/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { Input, EModalPosition, EModalWidth, ModalCore } from "@plane/ui";

export function SelectMonthModal({
  initialValues,
  months,
  canConfigure,
  pending,
  error,
  handleClose,
  handleChange,
}: {
  initialValues: FunctionArgs<typeof api.projects.inactivity.save>;
  months: FunctionReturnType<typeof api.projects.inactivity.get>["months"];
  canConfigure: boolean;
  pending: boolean;
  error: string;
  handleClose: () => void;
  handleChange: (months: FunctionReturnType<typeof api.projects.inactivity.get>["months"][number]) => Promise<void>;
}) {
  const [value, setValue] = useState(
    String(initialValues.changes.close?.months ?? initialValues.changes.archiveMonths)
  );
  const selected = months.find((month) => month === Number(value));
  return (
    <ModalCore isOpen handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <form
        className="space-y-5 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected !== undefined && canConfigure && !pending) void handleChange(selected);
        }}
      >
        <Dialog.Title className="text-16 leading-6 font-medium text-primary">Customize time range</Dialog.Title>
        <Dialog.Description className="text-13 text-secondary">
          Choose how many months of inactivity to wait. One month is 30 days.
        </Dialog.Description>
        <div className="space-y-2">
          <label htmlFor="automation-months" className="text-13 font-medium">
            Months
          </label>
          <Input
            id="automation-months"
            name="months"
            type="number"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            min={months[0]}
            max={months.at(-1)}
            step={1}
            required
            disabled={pending || !canConfigure}
            hasError={selected === undefined}
            className="w-full"
          />
          {selected === undefined && (
            <p className="text-13 text-danger-primary">
              Choose a whole number of months between {months[0]} and {months.at(-1)}.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-13 text-danger-primary">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="lg" disabled={pending} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={selected === undefined || !canConfigure}
            loading={pending}
          >
            Submit
          </Button>
        </div>
      </form>
    </ModalCore>
  );
}
