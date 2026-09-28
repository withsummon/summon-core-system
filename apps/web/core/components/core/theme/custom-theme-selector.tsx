/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { CustomThemeColorInputs } from "./color-inputs";
import { CustomThemeDownloadConfigButton } from "./download-config-button";
import { CustomThemeImportConfigButton } from "./import-config-button";
import { CustomThemeModeSelector } from "./theme-mode-selector";

export type CustomTheme = FunctionReturnType<typeof api.identity.profile.get>["preferences"]["theme"];

export function CustomThemeSelector({
  theme,
  revision,
  onSave,
}: {
  theme: CustomTheme;
  revision: number;
  onSave: (theme: CustomTheme, expectedRevision: number) => Promise<{ revision: number }>;
}) {
  const { t } = useTranslation();
  const [expectedRevision, setExpectedRevision] = useState(revision);
  const [pending, setPending] = useState(false);
  const { control, handleSubmit, getValues, setValue } = useForm<CustomTheme>({
    defaultValues: {
      theme: "custom",
      primary: theme.primary ?? "#3f76ff",
      background: theme.background ?? "#1a1a1a",
      darkPalette: theme.darkPalette ?? false,
    },
  });

  const handleUpdateTheme = async (formData: CustomTheme) => {
    setPending(true);
    try {
      const saved = await onSave(formData, expectedRevision);
      setExpectedRevision(saved.revision);
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(async (formData) => {
        try {
          await handleUpdateTheme(formData);
          setToast({ type: TOAST_TYPE.SUCCESS, title: t("success"), message: "Theme updated successfully" });
        } catch (error) {
          setToast({ type: TOAST_TYPE.ERROR, title: t("error"), message: mutationMessage(error) });
        }
      })}
      className="rounded-lg border border-subtle bg-layer-1 px-4 py-3"
    >
      <fieldset disabled={pending}>
        <div className="space-y-5">
          <ProfileSettingsHeading
            title={t("customize_your_theme")}
            control={<CustomThemeImportConfigButton handleUpdateTheme={handleUpdateTheme} setValue={setValue} />}
          />
          <CustomThemeModeSelector control={control} />
          <CustomThemeColorInputs control={control} />
        </div>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="primary" size="lg" type="submit" loading={pending}>
            {pending ? t("common.saving") : t("set_theme")}
          </Button>
          <CustomThemeDownloadConfigButton getValues={getValues} />
        </div>
      </fieldset>
      {revision !== expectedRevision && !pending && (
        <p role="status" className="mt-3 text-caption-md-regular text-secondary">
          Your preferences changed elsewhere. Reopen this page before saving the custom theme.
        </p>
      )}
    </form>
  );
}
