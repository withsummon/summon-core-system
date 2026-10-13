/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
import { E_PASSWORD_STRENGTH } from "@plane/constants";
// types
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IUser, TUserProfile, TOnboardingSteps } from "@plane/types";
// ui
import { Input, Spinner } from "@plane/ui";
// components
import { getPasswordStrength, validatePersonName } from "@plane/utils";
// hooks
import { useUser, useUserProfile } from "@/hooks/store/user";
// services
import { AuthService } from "@/services/auth.service";
// local imports
import type { TProfileSetupFormValues } from "./profile-setup-fields";
import { PasswordSetupFields, PersonalizationFields, ProfileAvatarField } from "./profile-setup-fields";

const defaultValues: Partial<TProfileSetupFormValues> = {
  first_name: "",
  last_name: "",
  avatar_url: "",
  password: undefined,
  confirm_password: undefined,
  role: undefined,
  use_case: [],
};

type Props = {
  user?: IUser;
  totalSteps: number;
  stepChange: (steps: Partial<TOnboardingSteps>) => Promise<void>;
  finishOnboarding: () => Promise<void>;
};

enum EProfileSetupSteps {
  ALL = "ALL",
  USER_DETAILS = "USER_DETAILS",
  USER_PERSONALIZATION = "USER_PERSONALIZATION",
}

const authService = new AuthService();

export const ProfileSetup = observer(function ProfileSetup(props: Props) {
  const { user, totalSteps, stepChange, finishOnboarding } = props;
  // states
  const [profileSetupStep, setProfileSetupStep] = useState<EProfileSetupSteps>(
    user?.is_password_autoset ? EProfileSetupSteps.USER_DETAILS : EProfileSetupSteps.ALL
  );
  // store hooks
  const { updateCurrentUser } = useUser();
  const { updateUserProfile } = useUserProfile();
  // form info
  const {
    getValues,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<TProfileSetupFormValues>({
    defaultValues: {
      ...defaultValues,
      first_name: user?.first_name,
      last_name: user?.last_name,
      avatar_url: user?.avatar_url,
    },
    mode: "onChange",
  });
  const handleSetPassword = async (password: string) => {
    const token = await authService.requestCSRFToken().then((data) => data?.csrf_token);
    await authService.setPassword(token, { password });
  };

  const handleSubmitProfileSetup = async (formData: TProfileSetupFormValues) => {
    const userDetailsPayload: Partial<IUser> = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      avatar_url: formData.avatar_url ?? undefined,
    };
    const profileUpdatePayload: Partial<TUserProfile> = {
      use_case: formData.use_case && formData.use_case.length > 0 ? formData.use_case.join(". ") : undefined,
      role: formData.role,
    };
    try {
      await Promise.all([
        updateCurrentUser(userDetailsPayload),
        updateUserProfile(profileUpdatePayload),
        totalSteps > 2 && stepChange({ profile_complete: true }),
      ]);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success",
        message: "Profile setup completed!",
      });
      // For Invited Users, they will skip all other steps and finish onboarding.
      if (totalSteps <= 2) {
        finishOnboarding();
      }
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "Profile setup failed. Please try again!",
      });
    }
  };

  const handleSubmitUserDetail = async (formData: TProfileSetupFormValues) => {
    const userDetailsPayload: Partial<IUser> = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      avatar_url: formData.avatar_url ?? undefined,
    };
    try {
      await Promise.all([
        updateCurrentUser(userDetailsPayload),
        formData.password && handleSetPassword(formData.password),
      ]).then(() => {
        if (formData.password) {
        } else {
          setProfileSetupStep(EProfileSetupSteps.USER_PERSONALIZATION);
        }
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "User details update failed. Please try again!",
      });
    }
  };

  const handleSubmitUserPersonalization = async (formData: TProfileSetupFormValues) => {
    const profileUpdatePayload: Partial<TUserProfile> = {
      use_case: formData.use_case && formData.use_case.length > 0 ? formData.use_case.join(". ") : undefined,
      role: formData.role,
    };
    try {
      await Promise.all([
        updateUserProfile(profileUpdatePayload),
        totalSteps > 2 && stepChange({ profile_complete: true }),
      ]);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success",
        message: "Profile setup completed!",
      });
      // For Invited Users, they will skip all other steps and finish onboarding.
      if (totalSteps <= 2) {
        finishOnboarding();
      }
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "Profile setup failed. Please try again!",
      });
    }
  };

  const onSubmit = async (formData: TProfileSetupFormValues) => {
    if (!user) return;
    if (profileSetupStep === EProfileSetupSteps.ALL) await handleSubmitProfileSetup(formData);
    if (profileSetupStep === EProfileSetupSteps.USER_DETAILS) await handleSubmitUserDetail(formData);
    if (profileSetupStep === EProfileSetupSteps.USER_PERSONALIZATION) await handleSubmitUserPersonalization(formData);
  };

  // derived values
  const isPasswordAlreadySetup = !user?.is_password_autoset;
  const currentPassword = watch("password") || undefined;
  const currentConfirmPassword = watch("confirm_password") || undefined;

  // an empty password is valid (it is optional); otherwise it must be strong and confirmed
  const isValidPassword = useMemo(
    () =>
      !currentPassword ||
      (currentPassword === currentConfirmPassword &&
        getPasswordStrength(currentPassword) === E_PASSWORD_STRENGTH.STRENGTH_VALID),
    [currentPassword, currentConfirmPassword]
  );

  // Check for all available fields validation and if password field is available, then checks for password validation (strength + confirmation).
  // Also handles the condition for optional password i.e if password field is optional it only checks for above validation if it's not empty.
  const isButtonDisabled = isSubmitting || !isValid || (!isPasswordAlreadySetup && !isValidPassword);

  return (
    <div className="flex h-full w-full">
      <div className="mt-6 flex w-full flex-col items-center justify-center p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="mx-auto mt-2 w-full space-y-4 sm:w-96">
          {profileSetupStep !== EProfileSetupSteps.USER_PERSONALIZATION && (
            <>
              <ProfileAvatarField
                user={user}
                control={control}
                watch={watch}
                getValues={getValues}
                setValue={setValue}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    className="text-13 font-medium text-tertiary after:ml-0.5 after:text-danger-primary after:content-['*']"
                    htmlFor="first_name"
                  >
                    First name
                  </label>
                  <Controller
                    control={control}
                    name="first_name"
                    rules={{
                      required: "First name is required",
                      validate: validatePersonName,
                      maxLength: {
                        value: 50,
                        message: "First name must be within 50 characters.",
                      },
                    }}
                    render={({ field: { value, onChange, ref } }) => (
                      <Input
                        id="first_name"
                        name="first_name"
                        type="text"
                        value={value}
                        autoFocus
                        onChange={onChange}
                        ref={ref}
                        hasError={Boolean(errors.first_name)}
                        placeholder="Wilbur"
                        className="w-full border-strong"
                        autoComplete="on"
                      />
                    )}
                  />
                  {errors.first_name && (
                    <span className="text-13 text-danger-primary">{errors.first_name.message}</span>
                  )}
                </div>
                <div className="space-y-1">
                  <label
                    className="text-13 font-medium text-tertiary after:ml-0.5 after:text-danger-primary after:content-['*']"
                    htmlFor="last_name"
                  >
                    Last name
                  </label>
                  <Controller
                    control={control}
                    name="last_name"
                    rules={{
                      required: "Last name is required",
                      validate: validatePersonName,
                      maxLength: {
                        value: 50,
                        message: "Last name must be within 50 characters.",
                      },
                    }}
                    render={({ field: { value, onChange, ref } }) => (
                      <Input
                        id="last_name"
                        name="last_name"
                        type="text"
                        value={value}
                        onChange={onChange}
                        ref={ref}
                        hasError={Boolean(errors.last_name)}
                        placeholder="Wright"
                        className="w-full border-strong"
                        autoComplete="on"
                      />
                    )}
                  />
                  {errors.last_name && <span className="text-13 text-danger-primary">{errors.last_name.message}</span>}
                </div>
              </div>

              {/* setting up password for the first time */}
              {!isPasswordAlreadySetup && <PasswordSetupFields control={control} errors={errors} watch={watch} />}
            </>
          )}

          {/* user role once the password is set */}
          {profileSetupStep !== EProfileSetupSteps.USER_DETAILS && (
            <PersonalizationFields control={control} errors={errors} />
          )}
          <Button variant="primary" type="submit" size="xl" className="w-full" disabled={isButtonDisabled}>
            {isSubmitting ? <Spinner height="20px" width="20px" /> : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
});
