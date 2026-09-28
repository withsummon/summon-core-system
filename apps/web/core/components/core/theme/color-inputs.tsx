/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
// plane imports
import type { CustomTheme } from "./custom-theme-selector";
import { InputColorPicker } from "@plane/ui";

type Props = {
  control: Control<CustomTheme>;
};

export function CustomThemeColorInputs(props: Props) {
  const { control } = props;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Neutral Color */}
      <div className="flex flex-col gap-2">
        <label htmlFor="background" className="text-body-sm-medium">
          Neutral color<span className="text-danger-primary">*</span>
        </label>
        <div className="w-full">
          <Controller
            control={control}
            name="background"
            rules={{
              required: "Neutral color is required",
              pattern: {
                value: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
                message: "Enter a valid hex code",
              },
            }}
            render={({ field: { value, onChange }, fieldState: { error } }) => (
              <>
                <InputColorPicker
                  name="background"
                  value={value}
                  onChange={(color) => onChange(color && !color.startsWith("#") ? `#${color}` : color)}
                  placeholder="#1a1a1a"
                  className="w-full placeholder:text-placeholder"
                  style={{
                    backgroundColor: value,
                    color: "#ffffff",
                  }}
                  hasError={Boolean(error)}
                />
                {error && (
                  <p role="alert" className="mt-1 text-caption-md-regular text-danger-primary">
                    {error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>
      </div>
      {/* Brand Color */}
      <div className="flex flex-col gap-2">
        <label htmlFor="primary" className="text-body-sm-medium">
          Brand color<span className="text-danger-primary">*</span>
        </label>
        <div className="w-full">
          <Controller
            control={control}
            name="primary"
            rules={{
              required: "Brand color is required",
              pattern: {
                value: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
                message: "Enter a valid hex code",
              },
            }}
            render={({ field: { value, onChange }, fieldState: { error } }) => (
              <>
                <InputColorPicker
                  name="primary"
                  value={value}
                  onChange={(color) => onChange(color && !color.startsWith("#") ? `#${color}` : color)}
                  placeholder="#3f76ff"
                  className="w-full placeholder:text-placeholder"
                  style={{
                    backgroundColor: value,
                    color: "#ffffff",
                  }}
                  hasError={Boolean(error)}
                />
                {error && (
                  <p role="alert" className="mt-1 text-caption-md-regular text-danger-primary">
                    {error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
}
