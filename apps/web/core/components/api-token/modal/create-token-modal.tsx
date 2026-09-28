/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { add } from "date-fns";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Calendar } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { CheckIcon } from "@plane/propel/icons";
import { SelectPrimitive as Select } from "@plane/propel/select";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EModalPosition, EModalWidth, Input, ModalCore, TextArea, ToggleSwitch } from "@plane/ui";
import { cn, renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { DateDropdownView } from "@/components/dropdowns/date";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { GeneratedTokenDetails } from "./generated-token-details";

const EXPIRY_DATE_OPTIONS = {
  "1_week": { label: "1 week", value: { weeks: 1 } },
  "1_month": { label: "1 month", value: { months: 1 } },
  "3_months": { label: "3 months", value: { months: 3 } },
  "1_year": { label: "1 year", value: { years: 1 } },
};

export function CreateApiTokenModal({ onClose }: { onClose: () => void }) {
  const create = useMutation(api.identity.apiTokens.create);
  const profile = useQuery(api.identity.profile.get);
  const { t } = useTranslation();
  const [neverExpires, setNeverExpires] = useState(false);
  const [expiryChoice, setExpiryChoice] = useState<keyof typeof EXPIRY_DATE_OPTIONS | "custom" | null>(null);
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [generatedToken, setGeneratedToken] = useState<FunctionReturnType<typeof api.identity.apiTokens.create> | null>(
    null
  );
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FunctionArgs<typeof api.identity.apiTokens.create>>({
    defaultValues: { name: "", description: "", expiresAt: null },
  });
  const selectedOption = expiryChoice && expiryChoice !== "custom" ? EXPIRY_DATE_OPTIONS[expiryChoice] : null;
  const expiryDate = expiryChoice === "custom" ? customDate : selectedOption && add(new Date(), selectedOption.value);
  const handleClose = () => {
    if (!isSubmitting) onClose();
  };
  const onSubmit = async (fields: FunctionArgs<typeof api.identity.apiTokens.create>) => {
    if (isSubmitting) return;
    if (!neverExpires && !expiryDate) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Please select an expiration date." });
      return;
    }
    try {
      const receipt = await create({ ...fields, expiresAt: neverExpires || !expiryDate ? null : expiryDate.getTime() });
      setGeneratedToken(receipt);
    } catch (failure) {
      setToast({ type: TOAST_TYPE.ERROR, title: t("error"), message: mutationMessage(failure) });
    }
  };

  return (
    <ModalCore isOpen handleClose={handleClose} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      {generatedToken ? (
        <GeneratedTokenDetails handleClose={handleClose} tokenDetails={generatedToken} />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <fieldset disabled={isSubmitting} aria-busy={isSubmitting}>
            <div className="space-y-5 p-5">
              <Dialog.Title className="text-18 font-medium text-secondary">
                {t("workspace_settings.settings.api_tokens.create_token")}
              </Dialog.Title>
              <div className="space-y-3">
                <Input
                  {...register("name")}
                  required
                  aria-label={t("title")}
                  placeholder={t("title")}
                  className="w-full text-14"
                />
                <TextArea
                  {...register("description")}
                  aria-label={t("description")}
                  placeholder={t("description")}
                  className="min-h-24 w-full resize-none text-14"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select.Root<keyof typeof EXPIRY_DATE_OPTIONS | "custom" | null>
                      value={expiryChoice}
                      onValueChange={setExpiryChoice}
                      disabled={neverExpires || isSubmitting}
                      required={!neverExpires}
                      name="expiryChoice"
                    >
                      <Select.Trigger
                        aria-label="Token expiration"
                        className={cn(
                          "flex h-7 items-center gap-2 rounded-sm border-[0.5px] border-strong px-2 py-0.5 text-11 outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40",
                          { "text-placeholder": neverExpires }
                        )}
                      >
                        <Calendar className="h-3 w-3" />
                        {expiryChoice === "custom" ? "Custom date" : (selectedOption?.label ?? "Set expiration date")}
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Positioner
                          side="bottom"
                          align="start"
                          sideOffset={4}
                          alignItemWithTrigger={false}
                          className="z-[120]"
                        >
                          <Select.Popup className="max-h-48 min-w-48 overflow-y-auto rounded-md border border-subtle-1 bg-surface-1 p-2 text-11 shadow-raised-200 outline-none">
                            {Object.entries(EXPIRY_DATE_OPTIONS).map(([key, option]) => (
                              <Select.Item
                                key={key}
                                value={key}
                                className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-1 py-1.5 text-secondary outline-none select-none data-[highlighted]:bg-layer-transparent-hover"
                              >
                                <Select.ItemText className="min-w-0 flex-1">{option.label}</Select.ItemText>
                                <Select.ItemIndicator>
                                  <CheckIcon className="size-3.5 flex-shrink-0" />
                                </Select.ItemIndicator>
                              </Select.Item>
                            ))}
                            <Select.Item
                              value="custom"
                              className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-1 py-1.5 text-secondary outline-none select-none data-[highlighted]:bg-layer-transparent-hover"
                            >
                              <Select.ItemText className="min-w-0 flex-1">Custom</Select.ItemText>
                              <Select.ItemIndicator>
                                <CheckIcon className="size-3.5 flex-shrink-0" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          </Select.Popup>
                        </Select.Positioner>
                      </Select.Portal>
                    </Select.Root>
                    {expiryChoice === "custom" && profile && (
                      <div className="h-7">
                        <DateDropdownView
                          weekStartsOn={profile.preferences.startOfWeek}
                          value={customDate}
                          onChange={(date) => {
                            const selected = date === null ? null : new Date(date);
                            const now = new Date();
                            selected?.setHours(
                              now.getHours(),
                              now.getMinutes(),
                              now.getSeconds(),
                              now.getMilliseconds()
                            );
                            setCustomDate(selected);
                          }}
                          minDate={add(new Date(), { days: 1 })}
                          icon={<Calendar className="h-3 w-3" />}
                          buttonVariant="border-with-text"
                          placeholder="Set date"
                          disabled={neverExpires || isSubmitting}
                        />
                      </div>
                    )}
                  </div>
                  {!neverExpires && expiryDate && (
                    <span className="text-11 text-placeholder">
                      Expires {renderFormattedDate(expiryDate)} at {renderFormattedTime(expiryDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t-[0.5px] border-subtle px-5 py-4">
              <label className="flex cursor-pointer items-center gap-1.5">
                <ToggleSwitch
                  value={neverExpires}
                  label={t("workspace_settings.settings.api_tokens.never_expires")}
                  onChange={setNeverExpires}
                  disabled={isSubmitting}
                  size="sm"
                />
                <span className="text-11">{t("workspace_settings.settings.api_tokens.never_expires")}</span>
              </label>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleClose}>
                  {t("cancel")}
                </Button>
                <Button variant="primary" type="submit" loading={isSubmitting}>
                  {isSubmitting
                    ? t("workspace_settings.settings.api_tokens.generating")
                    : t("workspace_settings.settings.api_tokens.generate_token")}
                </Button>
              </div>
            </div>
          </fieldset>
        </form>
      )}
    </ModalCore>
  );
}
