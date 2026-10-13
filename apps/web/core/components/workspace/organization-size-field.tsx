/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Control, FieldError } from "react-hook-form";
import { Controller } from "react-hook-form";
import { ORGANIZATION_SIZE } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IWorkspace } from "@plane/types";
import { CustomSelect } from "@plane/ui";

type Props = {
  control: Control<IWorkspace>;
  error: FieldError | undefined;
};

/** Required organization-size select shared by the workspace creation forms. */
export function OrganizationSizeField(props: Props) {
  const { control, error } = props;
  const { t } = useTranslation();

  return (
    <div className="w-full">
      <Controller
        name="organization_size"
        control={control}
        rules={{ required: t("common.errors.required") }}
        render={({ field: { value, onChange } }) => (
          <CustomSelect
            value={value}
            onChange={onChange}
            label={
              ORGANIZATION_SIZE.find((c) => c === value) ?? (
                <span className="text-placeholder">{t("workspace_creation.form.organization_size.placeholder")}</span>
              )
            }
            input
          >
            {ORGANIZATION_SIZE.map((item) => (
              <CustomSelect.Option key={item} value={item}>
                {item}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        )}
      />
      {error && <span className="text-13 text-danger-primary">{error.message}</span>}
    </div>
  );
}
