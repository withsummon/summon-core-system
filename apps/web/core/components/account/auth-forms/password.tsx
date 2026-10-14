/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
// icons
import { Eye, EyeOff, Info, XCircle } from "lucide-react";
// plane imports
import { API_BASE_URL, E_PASSWORD_STRENGTH, AUTH_TRACKER_ELEMENTS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { CloseIcon } from "@plane/propel/icons";
import { Input, PasswordStrengthIndicator, Spinner } from "@plane/ui";
import { getPasswordStrength } from "@plane/utils";
// components
import { ForgotPasswordPopover } from "@/components/account/auth-forms/forgot-password-popover";
// constants
// helpers
import { EAuthModes, EAuthSteps } from "@/helpers/authentication.helper";
// services
import { AuthService } from "@/services/auth.service";

type Props = {
  email: string;
  isSMTPConfigured: boolean;
  mode: EAuthModes;
  handleEmailClear: () => void;
  handleAuthStep: (step: EAuthSteps) => void;
  nextPath: string | undefined;
};

type TPasswordFormValues = {
  email: string;
  password: string;
  confirm_password?: string;
};

const defaultValues: TPasswordFormValues = {
  email: "",
  password: "",
};

const authService = new AuthService();

/** Requests a CSRF token up front and writes it into the form's hidden field right before submit. */
const useCSRFToken = (formRef: React.RefObject<HTMLFormElement | null>) => {
  const [csrfPromise, setCsrfPromise] = useState<Promise<{ csrf_token: string }> | undefined>(undefined);

  useEffect(() => {
    if (csrfPromise === undefined) {
      const promise = authService.requestCSRFToken();
      setCsrfPromise(promise);
    }
  }, [csrfPromise]);

  return async () => {
    if (!formRef || !formRef.current) return;
    const token = await csrfPromise;
    if (!token?.csrf_token) return;
    const csrfElement = formRef.current.querySelector("input[name=csrfmiddlewaretoken]");
    csrfElement?.setAttribute("value", token?.csrf_token);
  };
};

function PasswordStrengthBanner({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="relative flex items-center gap-2 rounded-md border border-danger-strong/50 bg-danger-subtle p-2">
      <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <Info size={16} className="text-danger-primary" />
      </div>
      <div className="w-full text-13 font-medium text-danger-primary">{t("auth.sign_up.errors.password.strength")}</div>
      <button
        type="button"
        className="relative ml-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-xs text-accent-primary/80 transition-colors hover:bg-danger-subtle-hover"
        onClick={onClose}
        aria-label={t("aria_labels.auth_forms.close_alert")}
      >
        <CloseIcon className="h-4 w-4 shrink-0 text-danger-primary" />
      </button>
    </div>
  );
}

type TPasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string | undefined;
  placeholder: string;
  isVisible: boolean;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  onFocusChange: (isFocused: boolean) => void;
  children?: React.ReactNode;
};

function PasswordField(props: TPasswordFieldProps) {
  const { id, name, label, value, placeholder, isVisible, onChange, onToggleVisibility, onFocusChange, children } =
    props;
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-13 font-medium text-tertiary">
        {label}
      </label>
      <div className="relative flex items-center rounded-md bg-surface-1">
        <Input
          type={isVisible ? "text" : "password"}
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full border border-strong !bg-surface-1 pr-12 disable-autofill-style placeholder:text-placeholder"
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 grid size-5 place-items-center"
          aria-label={t(isVisible ? "aria_labels.auth_forms.hide_password" : "aria_labels.auth_forms.show_password")}
        >
          {isVisible ? <EyeOff className="size-5 stroke-placeholder" /> : <Eye className="size-5 stroke-placeholder" />}
        </button>
      </div>
      {children}
    </div>
  );
}

function EmailField(props: { value: string; onChange: (value: string) => void; onClear: () => void }) {
  const { value, onChange, onClear } = props;
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <label htmlFor="email" className="text-13 font-medium text-tertiary">
        {t("auth.common.email.label")}
      </label>
      <div className={`relative flex items-center rounded-md border border-strong bg-surface-1`}>
        <Input
          id="email"
          name="email"
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("auth.common.email.placeholder")}
          className={`h-10 w-full border-0 disable-autofill-style placeholder:text-placeholder`}
          disabled
        />
        {value.length > 0 && (
          <button
            type="button"
            className="absolute right-3 size-5"
            onClick={onClear}
            aria-label={t("aria_labels.auth_forms.clear_email")}
          >
            <XCircle className="size-5 stroke-placeholder" />
          </button>
        )}
      </div>
    </div>
  );
}

function PasswordSupport(props: {
  mode: EAuthModes;
  email: string;
  password: string;
  isSMTPConfigured: boolean;
  isFocused: boolean;
}) {
  const { mode, email, password, isSMTPConfigured, isFocused } = props;
  const { t } = useTranslation();
  if (mode !== EAuthModes.SIGN_IN) {
    if (password.length === 0 || getPasswordStrength(password) == E_PASSWORD_STRENGTH.STRENGTH_VALID) return null;
    return <PasswordStrengthIndicator password={password} isFocused={isFocused} />;
  }
  return (
    <div className="w-full">
      {isSMTPConfigured ? (
        <Link
          data-ph-element={AUTH_TRACKER_ELEMENTS.FORGOT_PASSWORD_FROM_SIGNIN}
          href={`/accounts/forgot-password?email=${encodeURIComponent(email)}`}
          className="text-11 font-medium text-accent-primary"
        >
          {t("auth.common.forgot_password")}
        </Link>
      ) : (
        <ForgotPasswordPopover />
      )}
    </div>
  );
}

function PasswordFormActions(props: {
  mode: EAuthModes;
  isSMTPConfigured: boolean;
  isSubmitting: boolean;
  isDisabled: boolean;
  onUniqueCodeSignIn: () => void;
}) {
  const { mode, isSMTPConfigured, isSubmitting, isDisabled, onUniqueCodeSignIn } = props;
  const { t } = useTranslation();
  const isSignIn = mode === EAuthModes.SIGN_IN;
  return (
    <div className="space-y-2.5">
      <Button type="submit" variant="primary" className="w-full" size="xl" disabled={isDisabled}>
        {isSubmitting ? (
          <Spinner height="20px" width="20px" />
        ) : isSignIn ? (
          "Continue to Summon Core"
        ) : (
          "Create account"
        )}
      </Button>
      {isSignIn && isSMTPConfigured && (
        <Button
          type="button"
          data-ph-element={AUTH_TRACKER_ELEMENTS.SIGN_IN_WITH_UNIQUE_CODE}
          onClick={onUniqueCodeSignIn}
          variant="secondary"
          className="w-full"
          size="xl"
        >
          {t("auth.common.sign_in_with_unique_code")}
        </Button>
      )}
    </div>
  );
}

export const AuthPasswordForm = observer(function AuthPasswordForm(props: Props) {
  const { email, isSMTPConfigured, handleAuthStep, handleEmailClear, mode, nextPath } = props;
  // plane imports
  const { t } = useTranslation();
  // ref
  const formRef = useRef<HTMLFormElement>(null);
  // states
  const [passwordFormData, setPasswordFormData] = useState<TPasswordFormValues>({ ...defaultValues, email });
  const [showPassword, setShowPassword] = useState({
    password: false,
    retypePassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);
  const [isRetryPasswordInputFocused, setIsRetryPasswordInputFocused] = useState(false);
  const [isBannerMessage, setBannerMessage] = useState(false);
  const handleCSRFToken = useCSRFToken(formRef);

  const isSignUp = mode === EAuthModes.SIGN_UP;

  const handleShowPassword = (key: keyof typeof showPassword) =>
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleFormChange = (key: keyof TPasswordFormValues, value: string) =>
    setPasswordFormData((prev) => ({ ...prev, [key]: value }));

  const redirectToUniqueCodeSignIn = () => {
    handleAuthStep(EAuthSteps.UNIQUE_CODE);
  };

  const isButtonDisabled = useMemo(
    () =>
      isSubmitting ||
      !passwordFormData.password ||
      (mode === EAuthModes.SIGN_UP && passwordFormData.password !== passwordFormData.confirm_password),
    [isSubmitting, mode, passwordFormData.confirm_password, passwordFormData.password]
  );

  const password = passwordFormData.password;
  const confirmPassword = passwordFormData.confirm_password ?? "";
  const renderPasswordMatchError = !isRetryPasswordInputFocused || confirmPassword.length >= password.length;
  const showPasswordMatchError = !!confirmPassword && password !== confirmPassword && renderPasswordMatchError;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent form from submitting by default
    await handleCSRFToken();
    const isPasswordValid = !isSignUp || getPasswordStrength(password) === E_PASSWORD_STRENGTH.STRENGTH_VALID;
    if (isPasswordValid) {
      setIsSubmitting(true);
      formRef.current?.submit(); // Manually submit the form if the condition is met
    } else {
      setBannerMessage(true);
    }
  };

  return (
    <>
      {isBannerMessage && isSignUp && <PasswordStrengthBanner onClose={() => setBannerMessage(false)} />}
      <form
        ref={formRef}
        className="space-y-4"
        method="POST"
        action={`${API_BASE_URL}/auth/${mode === EAuthModes.SIGN_IN ? "sign-in" : "sign-up"}/`}
        onSubmit={handleSubmit}
        onError={() => {
          setIsSubmitting(false);
        }}
      >
        <input type="hidden" name="csrfmiddlewaretoken" />
        <input type="hidden" value={passwordFormData.email} name="email" />
        {nextPath && <input type="hidden" value={nextPath} name="next_path" />}
        <EmailField
          value={passwordFormData.email}
          onChange={(value) => handleFormChange("email", value)}
          onClear={handleEmailClear}
        />

        <PasswordField
          id="password"
          name="password"
          label={mode === EAuthModes.SIGN_IN ? t("auth.common.password.label") : t("auth.common.password.set_password")}
          value={passwordFormData.password}
          placeholder={t("auth.common.password.placeholder")}
          isVisible={showPassword.password}
          onChange={(value) => handleFormChange("password", value)}
          onToggleVisibility={() => handleShowPassword("password")}
          onFocusChange={setIsPasswordInputFocused}
        >
          <PasswordSupport
            mode={mode}
            email={email}
            password={password}
            isSMTPConfigured={isSMTPConfigured}
            isFocused={isPasswordInputFocused}
          />
        </PasswordField>

        {isSignUp && (
          <PasswordField
            id="confirm-password"
            name="confirm_password"
            label={t("auth.common.password.confirm_password.label")}
            value={passwordFormData.confirm_password}
            placeholder={t("auth.common.password.confirm_password.placeholder")}
            isVisible={showPassword.retypePassword}
            onChange={(value) => handleFormChange("confirm_password", value)}
            onToggleVisibility={() => handleShowPassword("retypePassword")}
            onFocusChange={setIsRetryPasswordInputFocused}
          >
            {showPasswordMatchError && (
              <span className="text-13 text-danger-primary">{t("auth.common.password.errors.match")}</span>
            )}
          </PasswordField>
        )}

        <PasswordFormActions
          mode={mode}
          isSMTPConfigured={isSMTPConfigured}
          isSubmitting={isSubmitting}
          isDisabled={isButtonDisabled}
          onUniqueCodeSignIn={redirectToUniqueCodeSignIn}
        />
      </form>
    </>
  );
});
