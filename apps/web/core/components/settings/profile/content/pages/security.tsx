/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { Controller, useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
// plane imports
import { E_PASSWORD_STRENGTH } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input, PasswordStrengthIndicator } from "@plane/ui";
import { getPasswordStrength } from "@plane/utils";
// components
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";

export interface FormValues {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

const defaultValues: FormValues = {
  old_password: "",
  new_password: "",
  confirm_password: "",
};

const defaultShowPassword = {
  old_password: false,
  new_password: false,
  confirm_password: false,
};

export function SecurityProfileSettings() {
  const capabilities = useQuery(api.identity.password.index.capabilities);
  const setPassword = useMutation(api.identity.password.index.set);
  const changePassword = useMutation(api.identity.password.index.change);
  // states
  const [showPassword, setShowPassword] = useState(defaultShowPassword);
  const [focusedField, setFocusedField] = useState<keyof FormValues | null>(null);

  // use form
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ defaultValues });
  // derived values
  const oldPassword = watch("old_password");
  const password = watch("new_password");
  const confirmPassword = watch("confirm_password");
  const oldPasswordRequired = capabilities?.canChange === true;
  // i18n
  const { t } = useTranslation();

  const isNewPasswordSameAsOldPassword = password !== "" && password === oldPassword;
  const isPasswordInputFocused = focusedField === "new_password";
  const isRetryPasswordInputFocused = focusedField === "confirm_password";
  const isPasswordValid = getPasswordStrength(password) === E_PASSWORD_STRENGTH.STRENGTH_VALID;

  const handleShowPassword = (key: keyof typeof showPassword) =>
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleChangePassword = async (formData: FormValues) => {
    const { old_password, new_password } = formData;
    try {
      const denial = oldPasswordRequired
        ? await changePassword({ currentPassword: old_password, newPassword: new_password })
        : await setPassword({ newPassword: new_password });
      if (denial) {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: t("auth.common.password.toast.change_password.error.title"),
          message: denial.message,
        });
        return;
      }

      reset(defaultValues);
      setShowPassword(defaultShowPassword);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("auth.common.password.toast.change_password.success.title"),
        message: t("auth.common.password.toast.change_password.success.message"),
      });
    } catch (error: unknown) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("auth.common.password.toast.change_password.error.title"),
        message: mutationMessage(error),
      });
    }
  };

  const isButtonDisabled =
    !isPasswordValid ||
    (oldPasswordRequired && oldPassword.trim() === "") ||
    password !== confirmPassword ||
    password === oldPassword;

  const passwordSupport = password.length > 0 && !isPasswordValid && (
    <PasswordStrengthIndicator password={password} isFocused={isPasswordInputFocused} />
  );

  const renderPasswordMatchError = !isRetryPasswordInputFocused || confirmPassword.length >= password.length;

  if (!capabilities) return <p role="status">Loading password settings…</p>;
  if (!capabilities.canChange && !capabilities.canSet)
    return <p role="status">Password authentication is unavailable.</p>;
  const fields: (keyof FormValues)[] = oldPasswordRequired
    ? ["old_password", "new_password", "confirm_password"]
    : ["new_password", "confirm_password"];
  const fieldOptions = {
    old_password: {
      label: t("auth.common.password.current_password.label"),
      placeholder: t("old_password"),
      autoComplete: "current-password",
      className: "sm:col-span-2",
      support: null,
    },
    new_password: {
      label: t("auth.common.password.new_password.label"),
      placeholder: t("auth.common.password.new_password.placeholder"),
      autoComplete: "new-password",
      className: "",
      support: (
        <>
          {passwordSupport}
          {isNewPasswordSameAsOldPassword && !isPasswordInputFocused && (
            <span className="text-11 text-danger-primary">{t("new_password_must_be_different_from_old_password")}</span>
          )}
        </>
      ),
    },
    confirm_password: {
      label: t("auth.common.password.confirm_password.label"),
      placeholder: t("auth.common.password.confirm_password.placeholder"),
      autoComplete: "new-password",
      className: "",
      support: !!confirmPassword && password !== confirmPassword && renderPasswordMatchError && (
        <span className="text-13 text-danger-primary">{t("auth.common.password.errors.match")}</span>
      ),
    },
  };
  return (
    <div className="size-full">
      <ProfileSettingsHeading title={t("auth.common.password.change_password.label.default")} />
      <form onSubmit={handleSubmit(handleChangePassword)} className="mt-7 flex flex-col gap-8">
        <div className="flex flex-col gap-y-7">
          <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2">
            {fields.map((name) => (
              <div key={name} className={`flex flex-col gap-y-2 ${fieldOptions[name].className}`}>
                <label htmlFor={name} className="text-13">
                  {fieldOptions[name].label}
                </label>
                <div className="relative flex items-center rounded-md">
                  <Controller
                    control={control}
                    name={name}
                    rules={{ required: t("common.errors.required") }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id={name}
                        type={showPassword[name] ? "text" : "password"}
                        placeholder={fieldOptions[name].placeholder}
                        className="w-full"
                        hasError={Boolean(errors[name])}
                        onFocus={() => setFocusedField(name)}
                        onBlur={() => {
                          field.onBlur();
                          setFocusedField(null);
                        }}
                        autoComplete={fieldOptions[name].autoComplete}
                      />
                    )}
                  />
                  <button
                    type="button"
                    className="absolute right-3 grid size-5 place-items-center"
                    onClick={() => handleShowPassword(name)}
                    aria-label={t(
                      showPassword[name]
                        ? "aria_labels.auth_forms.hide_password"
                        : "aria_labels.auth_forms.show_password"
                    )}
                  >
                    {showPassword[name] ? (
                      <EyeOff className="size-5 stroke-placeholder" />
                    ) : (
                      <Eye className="size-5 stroke-placeholder" />
                    )}
                  </button>
                </div>
                {fieldOptions[name].support}
                {errors[name] && <span className="text-11 text-danger-primary">{errors[name].message}</span>}
              </div>
            ))}
          </div>
          <div>
            <Button variant="primary" size="xl" type="submit" loading={isSubmitting} disabled={isButtonDisabled}>
              {isSubmitting
                ? `${t("auth.common.password.change_password.label.submitting")}`
                : t("auth.common.password.change_password.label.default")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
