import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { E_PASSWORD_STRENGTH } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Input, PasswordStrengthIndicator } from "@plane/ui";
import { getPasswordStrength } from "@plane/utils";

type Props = {
  password: string;
  onPasswordChange: (value: string) => void;
  support?: ReactNode;
} & (
  | { confirm: false; confirmation?: never; onConfirmationChange?: never }
  | {
      confirm: true;
      confirmation: string;
      onConfirmationChange: (value: string) => void;
    }
);

export function PasswordFields({
  password,
  onPasswordChange,
  support,
  confirm,
  confirmation,
  onConfirmationChange,
}: Props) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState({ password: false, retypePassword: false });
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);
  const [isRetryPasswordInputFocused, setIsRetryPasswordInputFocused] = useState(false);
  const handleShowPassword = (key: keyof typeof showPassword) =>
    setShowPassword((previous) => ({ ...previous, [key]: !previous[key] }));
  const renderPasswordMatchError = !isRetryPasswordInputFocused || (confirmation?.length ?? 0) >= password.length;
  return (
    <>
      <div className="space-y-1">
        <label htmlFor="password" className="text-13 font-medium text-tertiary">
          {!confirm ? t("auth.common.password.label") : t("auth.common.password.set_password")}
        </label>
        <div className="relative flex items-center rounded-md bg-surface-1">
          <Input
            type={showPassword.password ? "text" : "password"}
            id="password"
            name="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={t("auth.common.password.placeholder")}
            className="h-10 w-full border border-strong !bg-surface-1 pr-12 disable-autofill-style placeholder:text-placeholder"
            onFocus={() => setIsPasswordInputFocused(true)}
            onBlur={() => setIsPasswordInputFocused(false)}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => handleShowPassword("password")}
            className="absolute right-3 grid size-5 place-items-center"
            aria-label={t(
              showPassword.password ? "aria_labels.auth_forms.hide_password" : "aria_labels.auth_forms.show_password"
            )}
          >
            {showPassword.password ? (
              <EyeOff className="size-5 stroke-placeholder" />
            ) : (
              <Eye className="size-5 stroke-placeholder" />
            )}
          </button>
        </div>
        {confirm
          ? password.length > 0 &&
            getPasswordStrength(password) !== E_PASSWORD_STRENGTH.STRENGTH_VALID && (
              <PasswordStrengthIndicator password={password} isFocused={isPasswordInputFocused} />
            )
          : support}
      </div>

      {confirm && (
        <div className="space-y-1">
          <label htmlFor="confirm-password" className="text-13 font-medium text-tertiary">
            {t("auth.common.password.confirm_password.label")}
          </label>
          <div className="relative flex items-center rounded-md bg-surface-1">
            <Input
              type={showPassword.retypePassword ? "text" : "password"}
              id="confirm-password"
              name="confirm_password"
              value={confirmation}
              onChange={(e) => onConfirmationChange(e.target.value)}
              placeholder={t("auth.common.password.confirm_password.placeholder")}
              className="h-10 w-full border border-strong !bg-surface-1 pr-12 disable-autofill-style placeholder:text-placeholder"
              onFocus={() => setIsRetryPasswordInputFocused(true)}
              onBlur={() => setIsRetryPasswordInputFocused(false)}
              autoComplete="off"
            />
            <button
              type="button"
              className="absolute right-3 grid size-5 place-items-center"
              aria-label={t(
                showPassword.retypePassword
                  ? "aria_labels.auth_forms.hide_password"
                  : "aria_labels.auth_forms.show_password"
              )}
              onClick={() => handleShowPassword("retypePassword")}
            >
              {showPassword.retypePassword ? (
                <EyeOff className="size-5 stroke-placeholder" />
              ) : (
                <Eye className="size-5 stroke-placeholder" />
              )}
            </button>
          </div>
          {!!confirmation && password !== confirmation && renderPasswordMatchError && (
            <span className="text-13 text-danger-primary">{t("auth.common.password.errors.match")}</span>
          )}
        </div>
      )}
    </>
  );
}
