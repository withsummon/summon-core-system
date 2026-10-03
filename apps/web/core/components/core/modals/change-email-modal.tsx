/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input, EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { cn } from "@plane/utils";
import { authClient } from "@/components/convex-core/provider";

type Props = { isOpen: boolean; onClose: () => void };

type TModalStep = "EMAIL" | "CURRENT_CODE" | "UNIQUE_CODE";
type TUniqueCodeValuesForm = { email: string; code: string };

const defaultValues: TUniqueCodeValuesForm = { email: "", code: "" };

export function ChangeEmailModal(props: Props) {
  const { isOpen, onClose } = props;
  // states
  const [currentStep, setCurrentStep] = useState<TModalStep>("EMAIL");
  const { data: session } = authClient.useSession();
  const { t } = useTranslation();
  const changeEmailT = (path: string) => t(`account_settings.profile.change_email_modal.${path}`);
  // form info
  const {
    handleSubmit,
    control,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TUniqueCodeValuesForm>({ defaultValues });

  const verifying = currentStep !== "EMAIL";

  const handleClose = () => {
    if (isSubmitting) return;
    reset({ ...defaultValues });
    setCurrentStep("EMAIL");
    onClose();
  };

  const onSubmit = async ({ email, code }: TUniqueCodeValuesForm) => {
    if (!session) {
      setError("email", { message: "Sign in again before changing your email." });
      return;
    }
    try {
      const result =
        currentStep === "EMAIL"
          ? await authClient.emailOtp.sendVerificationOtp({ email: session.user.email, type: "email-verification" })
          : currentStep === "CURRENT_CODE"
            ? await authClient.emailOtp.requestEmailChange({ newEmail: email, otp: code })
            : await authClient.emailOtp.changeEmail({ newEmail: email, otp: code });
      if (result.error) {
        setError(currentStep === "EMAIL" ? "email" : "code", { type: "server", message: result.error.message });
        return;
      }
      setValue("code", "");
      if (currentStep === "EMAIL") setCurrentStep("CURRENT_CODE");
      else if (currentStep === "CURRENT_CODE") setCurrentStep("UNIQUE_CODE");
      else {
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: changeEmailT("toasts.success_title"),
          message: changeEmailT("toasts.success_message"),
        });
        await authClient.signOut();
        reset(defaultValues);
        setCurrentStep("EMAIL");
        onClose();
      }
    } catch {
      setError(currentStep === "EMAIL" ? "email" : "code", {
        type: "server",
        message: "Could not complete this request. Check your connection and try again.",
      });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <div className="space-y-0 px-4 py-4">
        <h3 className="text-16 leading-6 font-medium text-primary">{changeEmailT("title")}</h3>
        <p className="my-4 text-13 text-secondary">{changeEmailT("description")}</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="change-email-address"
            className={cn("text-13 font-medium text-secondary", { "sr-only": !verifying })}
          >
            {changeEmailT("form.email.label")}
          </label>
          <Controller
            control={control}
            name="email"
            rules={{
              required: changeEmailT("form.email.errors.required"),
            }}
            render={({ field: { value, onChange, ref } }) => (
              <Input
                id="change-email-address"
                name="email"
                type="email"
                value={value}
                onChange={onChange}
                ref={ref}
                hasError={Boolean(errors.email)}
                placeholder={changeEmailT("form.email.placeholder")}
                className={cn(
                  { "border-danger-strong": errors.email },
                  { "cursor-not-allowed !bg-surface-2": verifying }
                )}
                autoComplete="email"
                required
                disabled={verifying || isSubmitting}
              />
            )}
          />
          {errors?.email && <span className="text-11 text-danger-primary">{errors?.email?.message}</span>}
        </div>

        {verifying && (
          <div className="flex flex-col gap-1">
            <label htmlFor="change-email-code" className="text-13 font-medium text-secondary">
              {currentStep === "CURRENT_CODE" ? "Current email verification code" : changeEmailT("form.code.label")}
            </label>
            <Controller
              control={control}
              name="code"
              rules={{ required: changeEmailT("form.code.errors.required") }}
              render={({ field: { value, onChange, ref } }) => (
                <Input
                  id="change-email-code"
                  name="code"
                  value={value}
                  onChange={onChange}
                  ref={ref}
                  placeholder={changeEmailT("form.code.placeholder")}
                  className={cn({ "border-danger-strong": errors.code })}
                  autoComplete="one-time-code"
                  required
                  disabled={isSubmitting}
                />
              )}
            />
            {errors?.code ? (
              <span className="text-11 text-danger-primary">{errors?.code?.message}</span>
            ) : (
              <span className="text-11 text-success-primary">
                {currentStep === "CURRENT_CODE"
                  ? `Enter the code sent to your current email, ${session?.user.email}.`
                  : changeEmailT("form.code.helper_text")}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-subtle py-4">
          <Button type="button" variant="secondary" size="lg" disabled={isSubmitting} onClick={handleClose}>
            {changeEmailT("actions.cancel")}
          </Button>
          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting || !session}>
            {isSubmitting
              ? changeEmailT("states.sending")
              : verifying
                ? changeEmailT("actions.confirm")
                : changeEmailT("actions.continue")}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
}
