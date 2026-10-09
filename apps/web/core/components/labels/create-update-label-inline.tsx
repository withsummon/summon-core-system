/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { TwitterPicker } from "react-color";
import { LABEL_COLOR_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Popover } from "@plane/propel/popover";
import { Input } from "@plane/ui";

export type ProjectLabel = FunctionReturnType<typeof api.tasks.labels.list>[number];
type Metadata = Extract<FunctionArgs<typeof api.tasks.labels.save>["change"], { kind: "metadata" }>["data"];
export function CreateUpdateLabelInline({
  data,
  onChange,
  isUpdating,
  canManage,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  data: Metadata;
  onChange: (data: Metadata) => void;
  isUpdating: boolean;
  canManage: boolean;
  pending: boolean;
  error: string;
  onSubmit: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <fieldset disabled={pending || !canManage} className="flex min-w-0 flex-1 items-center gap-2 bg-surface-1">
          <Popover>
            <Popover.Button className="inline-flex items-center text-14" aria-label="Label color">
              <span className="size-4 rounded-full" style={{ backgroundColor: data.color }} />
            </Popover.Button>
            <Popover.Panel className="z-20 max-w-xs" positionerClassName="z-50" placement="bottom-start">
              <TwitterPicker
                colors={LABEL_COLOR_OPTIONS}
                color={data.color}
                onChange={(value) => onChange({ ...data, color: value.hex })}
              />
            </Popover.Panel>
          </Popover>
          <Input
            name="name"
            aria-label={t("project_settings.labels.label_title")}
            required
            maxLength={255}
            ref={input}
            value={data.name}
            onChange={(event) => onChange({ ...data, name: event.target.value })}
            placeholder={t("project_settings.labels.label_title")}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="primary" loading={pending}>
            {isUpdating ? t("update") : t("add")}
          </Button>
        </fieldset>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="p-0.5 text-13 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
