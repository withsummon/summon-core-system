/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
// icons
import { Eye, EyeOff } from "lucide-react";
// plane internal packages
import { API_BASE_URL, E_PASSWORD_STRENGTH } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { AuthService } from "@plane/services";
import { Checkbox, Input, PasswordStrengthIndicator, Spinner } from "@plane/ui";
import { getPasswordStrength, validatePersonName, validateCompanyName } from "@plane/utils";
// components
import { AuthHeader } from "@/app/(all)/(home)/auth-header";
import { Banner } from "../common/banner";
import { FormHeader } from "./form-header";

// service initialization
const authService = new AuthService();

// error codes
enum EErrorCodes {
  INSTANCE_NOT_CONFIGURED = "INSTANCE_NOT_CONFIGURED",
  ADMIN_ALREADY_EXIST = "ADMIN_ALREADY_EXIST",
  REQUIRED_EMAIL_PASSWORD_FIRST_NAME = "REQUIRED_EMAIL_PASSWORD_FIRST_NAME",
  INVALID_EMAIL = "INVALID_EMAIL",
  INVALID_PASSWORD = "INVALID_PASSWORD",
  USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS",
}

type TError = {
  type: EErrorCodes | undefined;
  message: string | undefined;
};

// form data
type TFormData = {
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  password: string;
  confirm_password?: string;
  is_telemetry_enabled: boolean;
};

const defaultFromData: TFormData = {
  first_name: "",
  last_name: "",
  email: "",
  company_name: "",
  password: "",
  is_telemetry_enabled: true,
};

const EMPTY_ERROR: TError = { type: undefined, message: undefined };

const getErrorData = (errorCode: string | null | undefined, errorMessage: string | null | undefined): TError => {
  if (!errorCode || !errorMessage) return EMPTY_ERROR;
  const type = Object.values(EErrorCodes).find((code) => code === errorCode);
  return type ? { type, message: errorMessage } : EMPTY_ERROR;
};

type TPrefillField = "first_name" | "last_name" | "company_name" | "email";

/** Keeps only the non-empty values, so empty params never overwrite what the user typed. */
const pickFilled = (values: Record<TPrefillField, string | null | undefined>) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => !!value)) as Partial<Pick<TFormData, TPrefillField>>;

/** Waits until the retyped password is at least as long as the original while the user is still typing it. */
const isPasswordMismatchVisible = (formData: TFormData, isRetypeFocused: boolean) => {
  const password = formData.password ?? "";
  const confirmPassword = formData.confirm_password ?? "";
  if (!confirmPassword || password === confirmPassword) return false;
  return !isRetypeFocused || confirmPassword.length >= password.length;
};

const isSetupFormComplete = (formData: TFormData) =>
  !!formData.first_name &&
  !!formData.email &&
  !!formData.password &&
  getPasswordStrength(formData.password) === E_PASSWORD_STRENGTH.STRENGTH_VALID &&
  formData.password === formData.confirm_password;

type TPasswordFieldProps = {
  id: "password" | "confirm_password";
  label: string;
  placeholder: string;
  value: string | undefined;
  inputClassName: string;
  hasError?: boolean;
  isVisible: boolean;
  onToggleVisibility: () => void;
  onChange: (value: string) => void;
  onFocusChange: (isFocused: boolean) => void;
  children?: React.ReactNode;
};

function PasswordField(props: TPasswordFieldProps) {
  const {
    id,
    label,
    placeholder,
    value,
    inputClassName,
    hasError,
    isVisible,
    onToggleVisibility,
    onChange,
    onFocusChange,
    children,
  } = props;
  const ToggleIcon = isVisible ? EyeOff : Eye;

  return (
    <div className="w-full space-y-1">
      <label className="text-13 font-medium text-tertiary" htmlFor={id}>
        {label} <span className="text-danger-primary">*</span>
      </label>
      <div className="relative">
        <Input
          className={inputClassName}
          id={id}
          name={id}
          type={isVisible ? "text" : "password"}
          inputSize="md"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          hasError={hasError}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          autoComplete="new-password"
        />
        <button
          type="button"
          aria-label={isVisible ? "Hide password" : "Show password"}
          className="absolute top-3.5 right-3 flex items-center justify-center text-placeholder"
          onClick={onToggleVisibility}
        >
          <ToggleIcon className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

type TPersonNameFieldProps = {
  id: "first_name" | "last_name";
  label: string;
  placeholder: string;
  value: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
};

function PersonNameField({ id, label, placeholder, value, autoFocus, onChange }: TPersonNameFieldProps) {
  return (
    <div className="w-full space-y-1">
      <label className="text-13 font-medium text-tertiary" htmlFor={id}>
        {label} <span className="text-danger-primary">*</span>
      </label>
      <Input
        className="w-full border border-subtle !bg-surface-1 placeholder:text-placeholder"
        id={id}
        name={id}
        type="text"
        inputSize="md"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          if (validatePersonName(e.target.value) === true || e.target.value === "") onChange(e.target.value);
        }}
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={50}
      />
    </div>
  );
}

export function InstanceSetupForm() {
  // search params
  const searchParams = useSearchParams();
  const firstNameParam = searchParams?.get("first_name");
  const lastNameParam = searchParams?.get("last_name");
  const companyParam = searchParams?.get("company");
  const emailParam = searchParams?.get("email");
  const errorCode = searchParams?.get("error_code");
  const errorMessage = searchParams?.get("error_message");
  // state
  const [showPassword, setShowPassword] = useState({
    password: false,
    retypePassword: false,
  });
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<TFormData>(defaultFromData);
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryPasswordInputFocused, setIsRetryPasswordInputFocused] = useState(false);

  const handleShowPassword = (key: keyof typeof showPassword) =>
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleFormChange = (key: keyof TFormData, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (csrfToken === undefined)
      authService.requestCSRFToken().then((data) => data?.csrf_token && setCsrfToken(data.csrf_token));
  }, [csrfToken]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      ...pickFilled({
        first_name: firstNameParam,
        last_name: lastNameParam,
        company_name: companyParam,
        email: emailParam,
      }),
      // the telemetry query param has always resolved to enabled
      is_telemetry_enabled: true,
    }));
  }, [firstNameParam, lastNameParam, companyParam, emailParam]);

  // derived values
  const errorData = useMemo(() => getErrorData(errorCode, errorMessage), [errorCode, errorMessage]);

  const isButtonDisabled = isSubmitting || !isSetupFormComplete(formData);

  const isEmailError = errorData.type === EErrorCodes.INVALID_EMAIL;
  const isPasswordError = errorData.type === EErrorCodes.INVALID_PASSWORD;

  const bannerErrorMessage = isEmailError || isPasswordError ? undefined : errorData.message;
  const showPasswordMismatch = isPasswordMismatchVisible(formData, isRetryPasswordInputFocused);

  return (
    <>
      <AuthHeader />
      <div className="mt-10 flex w-full flex-grow flex-col items-center justify-center py-6">
        <div className="relative flex w-full max-w-[22.5rem] flex-col gap-6">
          <FormHeader
            heading="Setup your Plane Instance"
            subHeading="Post setup you will be able to manage this Plane instance."
          />
          {bannerErrorMessage && <Banner type="error" message={bannerErrorMessage} />}
          <form
            className="space-y-4"
            method="POST"
            action={`${API_BASE_URL}/api/instances/admins/sign-up/`}
            onSubmit={() => setIsSubmitting(true)}
            onError={() => setIsSubmitting(false)}
          >
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken ?? ""} />
            <input type="hidden" name="is_telemetry_enabled" value={formData.is_telemetry_enabled ? "True" : "False"} />

            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <PersonNameField
                id="first_name"
                label="First name"
                placeholder="Wilber"
                value={formData.first_name}
                onChange={(value) => handleFormChange("first_name", value)}
                autoFocus
              />
              <PersonNameField
                id="last_name"
                label="Last name"
                placeholder="Wright"
                value={formData.last_name}
                onChange={(value) => handleFormChange("last_name", value)}
              />
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="email">
                Email <span className="text-danger-primary">*</span>
              </label>
              <Input
                className="w-full border border-subtle !bg-surface-1 placeholder:text-placeholder"
                id="email"
                name="email"
                type="email"
                inputSize="md"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
                hasError={isEmailError}
                autoComplete="off"
              />
              {isEmailError && errorData.message && (
                <p className="px-1 text-11 text-danger-primary">{errorData.message}</p>
              )}
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="company_name">
                Company name <span className="text-danger-primary">*</span>
              </label>
              <Input
                className="w-full border border-subtle !bg-surface-1 placeholder:text-placeholder"
                id="company_name"
                name="company_name"
                type="text"
                inputSize="md"
                placeholder="Company name"
                value={formData.company_name}
                onChange={(e) => {
                  const validation = validateCompanyName(e.target.value, false);
                  if (validation === true || e.target.value === "") {
                    handleFormChange("company_name", e.target.value);
                  }
                }}
                maxLength={80}
              />
            </div>

            <PasswordField
              id="password"
              label="Set a password"
              placeholder="New password"
              value={formData.password}
              inputClassName="w-full border border-subtle !bg-surface-1 placeholder:text-placeholder"
              hasError={isPasswordError}
              isVisible={showPassword.password}
              onToggleVisibility={() => handleShowPassword("password")}
              onChange={(value) => handleFormChange("password", value)}
              onFocusChange={setIsPasswordInputFocused}
            >
              {isPasswordError && errorData.message && (
                <p className="px-1 text-11 text-danger-primary">{errorData.message}</p>
              )}
              <PasswordStrengthIndicator password={formData.password} isFocused={isPasswordInputFocused} />
            </PasswordField>

            <PasswordField
              id="confirm_password"
              label="Confirm password"
              placeholder="Confirm password"
              value={formData.confirm_password}
              inputClassName="w-full border border-subtle !bg-surface-1 pr-12 placeholder:text-placeholder"
              isVisible={showPassword.retypePassword}
              onToggleVisibility={() => handleShowPassword("retypePassword")}
              onChange={(value) => handleFormChange("confirm_password", value)}
              onFocusChange={setIsRetryPasswordInputFocused}
            >
              {showPasswordMismatch && <span className="text-13 text-danger-primary">Passwords don{"'"}t match</span>}
            </PasswordField>

            <div className="relative flex gap-2">
              <div>
                <Checkbox
                  className="h-4 w-4"
                  iconClassName="w-3 h-3"
                  id="is_telemetry_enabled"
                  onCheckedChange={(checked) => handleFormChange("is_telemetry_enabled", checked)}
                  checked={formData.is_telemetry_enabled}
                />
              </div>
              <label className="cursor-pointer text-13 font-medium text-tertiary" htmlFor="is_telemetry_enabled">
                Allow Plane to anonymously collect usage events.{" "}
                <a
                  href="https://developers.plane.so/self-hosting/telemetry"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-13 font-medium text-link-primary hover:text-link-primary-hover"
                >
                  See More
                </a>
              </label>
            </div>

            <div className="py-2">
              <Button type="submit" size="xl" className="w-full" disabled={isButtonDisabled}>
                {isSubmitting ? <Spinner height="20px" width="20px" /> : "Continue"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
