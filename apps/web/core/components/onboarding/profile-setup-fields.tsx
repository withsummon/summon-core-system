/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { Control, FieldErrors, UseFormGetValues, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { IUser } from "@plane/types";
import { Input, PasswordStrengthIndicator } from "@plane/ui";
import { cn, getFileURL } from "@plane/utils";
// components
import { UserImageUploadModal } from "@/components/core/modals/user-image-upload-modal";

export type TProfileSetupFormValues = {
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  password?: string;
  confirm_password?: string;
  role?: string;
  use_case?: string[];
};

const USER_ROLE = ["Individual contributor", "Senior Leader", "Manager", "Executive", "Freelancer", "Student"];

const USER_DOMAIN = [
  "Engineering",
  "Product",
  "Marketing",
  "Sales",
  "Operations",
  "Legal",
  "Finance",
  "Human Resources",
  "Project",
  "Other",
];

type TProfileAvatarFieldProps = {
  user?: IUser;
  control: Control<TProfileSetupFormValues>;
  watch: UseFormWatch<TProfileSetupFormValues>;
  getValues: UseFormGetValues<TProfileSetupFormValues>;
  setValue: UseFormSetValue<TProfileSetupFormValues>;
};

export function ProfileAvatarField({ user, control, watch, getValues, setValue }: TProfileAvatarFieldProps) {
  // states
  const [isImageUploadModalOpen, setIsImageUploadModalOpen] = useState(false);
  // derived values
  const userAvatar = watch("avatar_url");

  const handleDelete = (url: string | null | undefined) => {
    if (!url) return;
    setValue("avatar_url", "");
  };

  return (
    <>
      <Controller
        control={control}
        name="avatar_url"
        render={({ field: { onChange, value } }) => (
          <UserImageUploadModal
            isOpen={isImageUploadModalOpen}
            onClose={() => setIsImageUploadModalOpen(false)}
            handleRemove={async () => handleDelete(getValues("avatar_url"))}
            onSuccess={(url) => {
              onChange(url);
              setIsImageUploadModalOpen(false);
            }}
            value={value && value.trim() !== "" ? value : null}
          />
        )}
      />
      <div className="flex items-center justify-center space-y-1">
        <button type="button" onClick={() => setIsImageUploadModalOpen(true)}>
          {!userAvatar || userAvatar === "" ? (
            <div className="flex flex-col items-center justify-between">
              <div className="relative h-14 w-14 overflow-hidden">
                <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center rounded-full bg-accent-primary text-24 font-medium text-on-color uppercase">
                  {watch("first_name")[0] ?? "R"}
                </div>
              </div>
              <div className="pt-1 text-13 font-medium text-accent-secondary hover:text-tertiary">Choose image</div>
            </div>
          ) : (
            <div className="relative mr-3 h-16 w-16 overflow-hidden">
              <img
                src={getFileURL(userAvatar ?? "")}
                className="absolute top-0 left-0 h-full w-full rounded-full object-cover"
                alt={user?.display_name}
              />
            </div>
          )}
        </button>
      </div>
    </>
  );
}

type TPasswordSetupFieldsProps = {
  control: Control<TProfileSetupFormValues>;
  errors: FieldErrors<TProfileSetupFormValues>;
  watch: UseFormWatch<TProfileSetupFormValues>;
};

export function PasswordSetupFields({ control, errors, watch }: TPasswordSetupFieldsProps) {
  const { t } = useTranslation();
  // states
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);
  const [showPassword, setShowPassword] = useState({
    password: false,
    retypePassword: false,
  });

  const handleShowPassword = (key: keyof typeof showPassword) =>
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
      <div className="space-y-1">
        <label className="text-13 font-medium text-tertiary" htmlFor="password">
          Set a password ({t("common.optional")})
        </label>
        <Controller
          control={control}
          name="password"
          rules={{
            required: false,
          }}
          render={({ field: { value, onChange, ref } }) => (
            <div className="relative flex items-center rounded-md">
              <Input
                type={showPassword.password ? "text" : "password"}
                name="password"
                value={value}
                onChange={onChange}
                ref={ref}
                hasError={Boolean(errors.password)}
                placeholder="New password…"
                className="w-full border-[0.5px] border-subtle pr-12 placeholder:text-placeholder"
                onFocus={() => setIsPasswordInputFocused(true)}
                onBlur={() => setIsPasswordInputFocused(false)}
                autoComplete="new-password"
              />
              {showPassword.password ? (
                <EyeOff
                  className="absolute right-3 h-4 w-4 stroke-placeholder hover:cursor-pointer"
                  onClick={() => handleShowPassword("password")}
                />
              ) : (
                <Eye
                  className="absolute right-3 h-4 w-4 stroke-placeholder hover:cursor-pointer"
                  onClick={() => handleShowPassword("password")}
                />
              )}
            </div>
          )}
        />
        <PasswordStrengthIndicator password={watch("password") ?? ""} isFocused={isPasswordInputFocused} />
      </div>
      <div className="space-y-1">
        <label className="text-13 font-medium text-tertiary" htmlFor="confirm_password">
          {t("auth.common.password.confirm_password.label")} ({t("common.optional")})
        </label>
        <Controller
          control={control}
          name="confirm_password"
          rules={{
            required: watch("password") ? true : false,
            validate: (value) =>
              watch("password") ? (value === watch("password") ? true : "Passwords don't match") : true,
          }}
          render={({ field: { value, onChange, ref } }) => (
            <div className="relative flex items-center rounded-md">
              <Input
                type={showPassword.retypePassword ? "text" : "password"}
                name="confirm_password"
                value={value}
                onChange={onChange}
                ref={ref}
                hasError={Boolean(errors.confirm_password)}
                placeholder={t("auth.common.password.confirm_password.placeholder")}
                className="w-full border-subtle pr-12 placeholder:text-placeholder"
                autoComplete="new-password"
              />
              {showPassword.retypePassword ? (
                <EyeOff
                  className="absolute right-3 h-4 w-4 stroke-placeholder hover:cursor-pointer"
                  onClick={() => handleShowPassword("retypePassword")}
                />
              ) : (
                <Eye
                  className="absolute right-3 h-4 w-4 stroke-placeholder hover:cursor-pointer"
                  onClick={() => handleShowPassword("retypePassword")}
                />
              )}
            </div>
          )}
        />
        {errors.confirm_password && (
          <span className="text-13 text-danger-primary">{errors.confirm_password.message}</span>
        )}
      </div>
    </>
  );
}

type TPersonalizationFieldsProps = {
  control: Control<TProfileSetupFormValues>;
  errors: FieldErrors<TProfileSetupFormValues>;
};

export function PersonalizationFields({ control, errors }: TPersonalizationFieldsProps) {
  return (
    <>
      <div className="space-y-1">
        <label
          className="text-13 font-medium text-tertiary after:ml-0.5 after:text-danger-primary after:content-['*']"
          htmlFor="role"
        >
          What role are you working on? Choose one.
        </label>
        <Controller
          control={control}
          name="role"
          rules={{
            required: "This field is required",
          }}
          render={({ field: { value, onChange } }) => (
            <div className="flex flex-wrap gap-2 overflow-auto py-2 break-all">
              {USER_ROLE.map((userRole) => (
                <button
                  type="button"
                  key={userRole}
                  aria-pressed={value === userRole}
                  className={cn(
                    "shrink-0 rounded border-[0.5px] px-3 py-1.5 text-13 font-medium hover:cursor-pointer hover:bg-surface-2",
                    {
                      "border-accent-strong": value === userRole,
                      "border-strong": value !== userRole,
                    }
                  )}
                  onClick={() => onChange(userRole)}
                >
                  {userRole}
                </button>
              ))}
            </div>
          )}
        />
        {errors.role && <span className="text-13 text-danger-primary">{errors.role.message}</span>}
      </div>
      <div className="space-y-1">
        <label
          className="text-13 font-medium text-tertiary after:ml-0.5 after:text-danger-primary after:content-['*']"
          htmlFor="use_case"
        >
          What is your domain expertise? Choose one or more.
        </label>
        <Controller
          control={control}
          name="use_case"
          rules={{
            required: "Please select at least one option",
            validate: (value) => (value && value.length > 0) || "Please select at least one option",
          }}
          render={({ field: { value, onChange } }) => (
            <div className="flex flex-wrap gap-2 overflow-auto py-2 break-all">
              {USER_DOMAIN.map((userDomain) => {
                const isSelected = value?.includes(userDomain) || false;
                return (
                  <button
                    type="button"
                    key={userDomain}
                    aria-pressed={isSelected}
                    className={`flex-shrink-0 border-[0.5px] hover:cursor-pointer hover:bg-surface-2 ${
                      isSelected ? "border-accent-strong" : "border-strong"
                    } rounded px-3 py-1.5 text-13 font-medium`}
                    onClick={() => {
                      const currentValue = value || [];
                      if (isSelected) {
                        onChange(currentValue.filter((item) => item !== userDomain));
                      } else {
                        onChange([...currentValue, userDomain]);
                      }
                    }}
                  >
                    {userDomain}
                  </button>
                );
              })}
            </div>
          )}
        />
        {errors.use_case && <span className="text-13 text-danger-primary">{errors.use_case.message}</span>}
      </div>
    </>
  );
}
