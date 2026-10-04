/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { estimateCount, MAX_ESTIMATE_POINT_INPUT_LENGTH } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { PlusIcon, TrashIcon } from "@plane/propel/icons";
import { Sortable } from "@plane/ui";
import { GripVertical } from "lucide-react";

export function EstimatePointCreateRoot({
  points,
  onChange,
  type,
  disabled,
}: {
  points: FunctionArgs<typeof api.estimates.index.create>["points"];
  onChange: (points: FunctionArgs<typeof api.estimates.index.create>["points"]) => void;
  type: FunctionArgs<typeof api.estimates.index.create>["type"];
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-1">
      <legend className="text-13 font-medium text-secondary capitalize">{type}</legend>
      <Sortable
        data={points}
        keyExtractor={(point) => String(point.key)}
        onChange={(rows) => {
          if (!disabled) onChange(rows.map((point, index) => ({ ...point, key: index + 1 })));
        }}
        render={(point) => (
          <div className="relative my-1 flex items-center gap-2 rounded-sm border border-subtle px-1 text-14">
            <GripVertical size={14} className="m-1 text-secondary" aria-hidden="true" />
            <input
              aria-label={`Estimate ${point.key}`}
              required
              type={type === "points" ? "number" : "text"}
              min={type === "points" ? Number.MIN_VALUE : undefined}
              step={type === "points" ? "any" : undefined}
              maxLength={MAX_ESTIMATE_POINT_INPUT_LENGTH}
              className="w-full bg-transparent py-2 text-13"
              value={point.value}
              onChange={(event) =>
                onChange(points.map((row) => (row.key === point.key ? { ...row, value: event.target.value } : row)))
              }
            />
            {points.length > estimateCount.min && (
              <button
                type="button"
                aria-label={`Remove estimate ${point.key}`}
                className="p-1 hover:bg-layer-1"
                onClick={() => onChange(points.filter((row) => row.key !== point.key))}
              >
                <TrashIcon width={14} height={14} />
              </button>
            )}
          </div>
        )}
      />
      {points.length < estimateCount.max && (
        <Button
          type="button"
          variant="link"
          prependIcon={<PlusIcon />}
          onClick={() => onChange([...points, { key: Math.max(...points.map((point) => point.key)) + 1, value: "" }])}
        >
          Add {type}
        </Button>
      )}
    </fieldset>
  );
}
