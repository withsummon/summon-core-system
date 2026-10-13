/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Eye, EyeOff, XCircle } from "lucide-react";
// plane imports
import { API_BASE_URL, E_PASSWORD_STRENGTH } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { AuthService } from "@plane/services";
import { Input, Spinner, PasswordStrengthIndicator } from "@plane/ui";
import { getPasswordStrength } from "@plane/utils";
// types
import { EAuthModes, EAuthSteps } from "@/types/auth";

type Props = {
  email: string;
  isPasswordAutoset: boolean;
  isSMTPConfigured: boolean;
  mode: EAuthModes;
  nextPath: string | undefined;
  handleEmailClear: () => void;
  handleAuthStep: (step: EAuthSteps) => void;
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

const isSignUpPasswordValid = (values: TPasswordFormValues) =>
  getPasswordStrength(values.password) === E_PASSWORD_STRENGTH.STRENGTH_VALID &&
  values.password === values.confirm_password;

/** Waits until the retyped password is at least as long as the original while the user is still typing it. */
const isPasswordMismatchVisible = (values: TPasswordFormValues, isRetypeFocused: boolean) => {
  const password = values.password ?? "";
  const confirmPassword = values.confirm_password ?? "";
  if (!confirmPassword || password === confirmPassword) return false;
  return !isRetypeFocused || confirmPassword.length >= password.length;
};

type TPasswordInputFieldProps = {
  name: "password" | "confirm_password";
  label: string;
  placeholder: string;
  value: string | undefined;
  isVisible: boolean;
  autoFocus?: boolean;
  onToggleVisibility: () => void;
  onChange: (value: string) => void;
  onFocusChange: (isFocused: boolean) => void;
  children?: React.ReactNode;
};

function PasswordInputField(props: TPasswordInputFieldProps) {
  const {
    name,
    label,
    placeholder,
    value,
    isVisible,
    autoFocus,
    onToggleVisibility,
    onChange,
    onFocusChange,
    children,
  } = props;
  const ToggleIcon = isVisible ? EyeOff : Eye;

  return (
    <div className="space-y-1">
      <label className="text-13 font-medium text-tertiary" htmlFor={name}>
        {label}
      </label>
      <div className="relative flex items-center rounded-md bg-surface-1">
        <Input
          type={isVisible ? "text" : "password"}
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full border border-subtle !bg-surface-1 pr-12 disable-autofill-style placeholder:text-placeholder"
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          autoComplete="off"
          autoFocus={autoFocus}
        />
        <ToggleIcon
          className="absolute right-3 h-5 w-5 stroke-placeholder hover:cursor-pointer"
          onClick={onToggleVisibility}
        />
      </div>
      {children}
    </div>
  );
}

type TPasswordFormActionsProps = {
  mode: EAuthModes;
  isSubmitting: boolean;
  isDisabled: boolean;
  isSMTPConfigured: boolean;
  onUniqueCodeSignIn: () => void;
};

function PasswordFormActions(props: TPasswordFormActionsProps) {
  const { mode, isSubmitting, isDisabled, isSMTPConfigured, onUniqueCodeSignIn } = props;

  return (
    <div className="space-y-2.5">
      {mode === EAuthModes.SIGN_IN ? (
        <>
          <Button type="submit" variant="primary" className="w-full" size="xl" disabled={isDisabled}>
            {isSubmitting ? <Spinner height="20px" width="20px" /> : isSMTPConfigured ? "Continue" : "Go to workspace"}
          </Button>
          {isSMTPConfigured && (
            <Button type="button" onClick={onUniqueCodeSignIn} variant="secondary" className="w-full" size="xl">
              Sign in with unique code
            </Button>
          )}
        </>
      ) : (
        <Button type="submit" variant="primary" className="w-full" size="xl" disabled={isDisabled}>
          {isSubmitting ? <Spinner height="20px" width="20px" /> : "Create account"}
        </Button>
      )}
    </div>
  );
}

export const AuthPasswordForm = observer(function AuthPasswordForm(props: Props) {
  const { email, nextPath, isSMTPConfigured, handleAuthStep, handleEmailClear, mode } = props;
  // ref
  const formRef = useRef<HTMLFormElement>(null);
  // states
  const [csrfPromise, setCsrfPromise] = useState<Promise<{ csrf_token: string }> | undefined>(undefined);
  const [passwordFormData, setPasswordFormData] = useState<TPasswordFormValues>({ ...defaultValues, email });
  const [showPassword, setShowPassword] = useState({
    password: false,
    retypePassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);
  const [isRetryPasswordInputFocused, setIsRetryPasswordInputFocused] = useState(false);

  const handleShowPassword = (key: keyof typeof showPassword) =>
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleFormChange = (key: keyof TPasswordFormValues, value: string) =>
    setPasswordFormData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (csrfPromise === undefined) {
      const promise = authService.requestCSRFToken();
      setCsrfPromise(promise);
    }
  }, [csrfPromise]);

  const redirectToUniqueCodeSignIn = async () => {
    handleAuthStep(EAuthSteps.UNIQUE_CODE);
  };

  const isSignUp = mode === EAuthModes.SIGN_UP;
  const showPasswordStrength =
    isSignUp &&
    passwordFormData.password.length > 0 &&
    getPasswordStrength(passwordFormData.password) !== E_PASSWORD_STRENGTH.STRENGTH_VALID;
  const isButtonDisabled =
    isSubmitting || !passwordFormData.password || (isSignUp && !isSignUpPasswordValid(passwordFormData));
  const showPasswordMismatch = isPasswordMismatchVisible(passwordFormData, isRetryPasswordInputFocused);

  const handleCSRFToken = async () => {
    if (!formRef || !formRef.current) return;
    const token = await csrfPromise;
    if (!token?.csrf_token) return;
    const csrfElement = formRef.current.querySelector("input[name=csrfmiddlewaretoken]");
    csrfElement?.setAttribute("value", token?.csrf_token);
  };

  return (
    <form
      ref={formRef}
      className="mt-5 space-y-4"
      method="POST"
      action={`${API_BASE_URL}/auth/spaces/${mode === EAuthModes.SIGN_IN ? "sign-in" : "sign-up"}/`}
      onSubmit={async (event) => {
        event.preventDefault();
        await handleCSRFToken();
        if (formRef.current) {
          formRef.current.submit();
        }
        setIsSubmitting(true);
      }}
      onError={() => setIsSubmitting(false)}
    >
      <input type="hidden" name="csrfmiddlewaretoken" />
      <input type="hidden" value={passwordFormData.email} name="email" />
      <input type="hidden" value={nextPath} name="next_path" />
      <div className="space-y-1">
        <label className="text-13 font-medium text-tertiary" htmlFor="email">
          Email
        </label>
        <div className={`relative flex items-center rounded-md border border-subtle bg-surface-1`}>
          <Input
            id="email"
            name="email"
            type="email"
            value={passwordFormData.email}
            onChange={(e) => handleFormChange("email", e.target.value)}
            placeholder="name@company.com"
            className={`h-10 w-full border-0 disable-autofill-style placeholder:text-placeholder`}
            disabled
          />
          {passwordFormData.email.length > 0 && (
            <XCircle
              className="absolute right-3 h-5 w-5 stroke-placeholder hover:cursor-pointer"
              onClick={handleEmailClear}
            />
          )}
        </div>
      </div>

      <PasswordInputField
        name="password"
        label={isSignUp ? "Set a password" : "Password"}
        placeholder="Enter password"
        value={passwordFormData.password}
        isVisible={showPassword.password}
        onToggleVisibility={() => handleShowPassword("password")}
        onChange={(value) => handleFormChange("password", value)}
        onFocusChange={setIsPasswordInputFocused}
        autoFocus
      >
        {showPasswordStrength && (
          <PasswordStrengthIndicator password={passwordFormData.password} isFocused={isPasswordInputFocused} />
        )}
      </PasswordInputField>

      {isSignUp && (
        <PasswordInputField
          name="confirm_password"
          label="Confirm password"
          placeholder="Confirm password"
          value={passwordFormData.confirm_password}
          isVisible={showPassword.retypePassword}
          onToggleVisibility={() => handleShowPassword("retypePassword")}
          onChange={(value) => handleFormChange("confirm_password", value)}
          onFocusChange={setIsRetryPasswordInputFocused}
        >
          {showPasswordMismatch && <span className="text-13 text-danger-primary">Passwords don{"'"}t match</span>}
        </PasswordInputField>
      )}

      <PasswordFormActions
        mode={mode}
        isSubmitting={isSubmitting}
        isDisabled={isButtonDisabled}
        isSMTPConfigured={isSMTPConfigured}
        onUniqueCodeSignIn={redirectToUniqueCodeSignIn}
      />
    </form>
  );
});
