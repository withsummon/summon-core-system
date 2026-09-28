/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import type { UseFormSetValue } from "react-hook-form";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { CustomTheme } from "./custom-theme-selector";

type Props = {
  handleUpdateTheme: (formData: CustomTheme) => Promise<void>;
  setValue: UseFormSetValue<CustomTheme>;
};

export function CustomThemeImportConfigButton(props: Props) {
  const { handleUpdateTheme, setValue } = props;
  // refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  // translation
  const { t } = useTranslation();

  const handleUploadConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const config: unknown = JSON.parse(text);

      if (
        typeof config !== "object" ||
        config === null ||
        !("primary" in config) ||
        typeof config.primary !== "string" ||
        !("background" in config) ||
        typeof config.background !== "string"
      )
        throw new Error("Theme configuration needs brand and neutral colors.");
      const darkPalette = "darkPalette" in config ? config.darkPalette : false;
      if (typeof darkPalette !== "boolean") throw new Error("Theme color mode must be a boolean.");

      // Apply the configuration to form
      const formData: CustomTheme = {
        theme: "custom",
        primary: config.primary,
        background: config.background,
        darkPalette,
      };

      // The mutation owner validates colors before the imported values are applied.
      await handleUpdateTheme(formData);

      // Update form values
      setValue("primary", formData.primary);
      setValue("background", formData.background);
      setValue("darkPalette", formData.darkPalette);
      setValue("theme", "custom");

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("success"),
        message: "Theme configuration imported successfully",
      });
    } catch (error) {
      console.error("Failed to upload config:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("error"),
        message: error instanceof Error ? error.message : "Failed to import theme configuration",
      });
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleUploadConfig} className="hidden" />
      <Button variant="secondary" size="lg" type="button" onClick={() => fileInputRef.current?.click()}>
        Import config
      </Button>
    </>
  );
}
