/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// icons
import { Eye, EyeOff } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Input, PasswordStrengthIndicator } from "@plane/ui";

type TNewPasswordField = "password" | "confirm_password";

type Props = {
  password: string;
  confirmPassword: string | undefined;
  onChange: (key: TNewPasswordField, value: string) => void;
};

/** Password + confirm-password inputs with visibility toggles, strength meter and mismatch hint. */
export function NewPasswordFields({ password, confirmPassword, onChange }: Props) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState({ password: false, retypePassword: false });
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);
  const [isRetryPasswordInputFocused, setIsRetryPasswordInputFocused] = useState(false);

  const handleShowPassword = (key: keyof typeof showPassword) =>
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderPasswordMatchError = !isRetryPasswordInputFocused || (confirmPassword ?? "").length >= password.length;
  const VisibilityIcon = showPassword.password ? EyeOff : Eye;
  const RetypeVisibilityIcon = showPassword.retypePassword ? EyeOff : Eye;

  return (
    <>
      <div className="space-y-1">
        <label className="text-13 font-medium text-tertiary" htmlFor="password">
          {t("auth.common.password.label")}
        </label>
        <div className="relative flex items-center rounded-md bg-surface-1">
          <Input
            type={showPassword.password ? "text" : "password"}
            name="password"
            value={password}
            onChange={(e) => onChange("password", e.target.value)}
            placeholder={t("auth.common.password.placeholder")}
            className="h-10 w-full border border-strong !bg-surface-1 pr-12 placeholder:text-placeholder"
            minLength={8}
            onFocus={() => setIsPasswordInputFocused(true)}
            onBlur={() => setIsPasswordInputFocused(false)}
            autoComplete="new-password"
            autoFocus
          />
          <VisibilityIcon
            className="absolute right-3 h-5 w-5 stroke-placeholder hover:cursor-pointer"
            onClick={() => handleShowPassword("password")}
          />
        </div>
        <PasswordStrengthIndicator password={password} isFocused={isPasswordInputFocused} />
      </div>
      <div className="space-y-1">
        <label className="text-13 font-medium text-tertiary" htmlFor="confirm_password">
          {t("auth.common.password.confirm_password.label")}
        </label>
        <div className="relative flex items-center rounded-md bg-surface-1">
          <Input
            type={showPassword.retypePassword ? "text" : "password"}
            name="confirm_password"
            value={confirmPassword}
            onChange={(e) => onChange("confirm_password", e.target.value)}
            placeholder={t("auth.common.password.confirm_password.placeholder")}
            className="h-10 w-full border border-strong !bg-surface-1 pr-12 placeholder:text-placeholder"
            onFocus={() => setIsRetryPasswordInputFocused(true)}
            onBlur={() => setIsRetryPasswordInputFocused(false)}
            autoComplete="new-password"
          />
          <RetypeVisibilityIcon
            className="absolute right-3 h-5 w-5 stroke-placeholder hover:cursor-pointer"
            onClick={() => handleShowPassword("retypePassword")}
          />
        </div>
        {!!confirmPassword && password !== confirmPassword && renderPasswordMatchError && (
          <span className="text-13 text-danger-primary">{t("auth.common.password.errors.match")}</span>
        )}
      </div>
    </>
  );
}
