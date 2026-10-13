/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Control, FieldValues } from "react-hook-form";
import { Monitor } from "lucide-react";
// plane internal packages
import { Button, getButtonStyling } from "@plane/propel/button";
import { cn } from "@plane/utils";
// components
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import type { TControllerSwitchFormField } from "@/components/common/controller-switch";
import { ControllerSwitch } from "@/components/common/controller-switch";
import type { TCopyField } from "@/components/common/copy-field";
import { CopyField } from "@/components/common/copy-field";

type OAuthConfigFormProps<T extends FieldValues> = {
  providerName: string;
  control: Control<T>;
  formFields: TControllerInputFormField[];
  switchField: TControllerSwitchFormField<T>;
  isDirty: boolean;
  isSubmitting: boolean;
  onSubmit: (e: React.MouseEvent<HTMLButtonElement>) => void;
  serviceDetails: ReactNode;
};

/** Shared layout for an OAuth provider configuration page: provider inputs on the left, Plane details on the right. */
export function OAuthConfigForm<T extends FieldValues>(props: OAuthConfigFormProps<T>) {
  const { providerName, control, formFields, switchField, isDirty, isSubmitting, onSubmit, serviceDetails } = props;
  const [isDiscardChangesModalOpen, setIsDiscardChangesModalOpen] = useState(false);

  const handleGoBack = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (isDirty) {
      e.preventDefault();
      setIsDiscardChangesModalOpen(true);
    }
  };

  return (
    <>
      <ConfirmDiscardModal
        isOpen={isDiscardChangesModalOpen}
        onDiscardHref="/authentication"
        handleClose={() => setIsDiscardChangesModalOpen(false)}
      />
      <div className="flex flex-col gap-8">
        <div className="grid w-full grid-cols-2 gap-x-12 gap-y-8">
          <div className="col-span-2 flex flex-col gap-y-4 pt-1 md:col-span-1">
            <div className="pt-2.5 text-18 font-medium">{providerName}-provided details for Plane</div>
            {formFields.map((field) => (
              <ControllerInput
                key={field.key}
                control={control}
                type={field.type}
                name={field.key}
                label={field.label}
                description={field.description}
                placeholder={field.placeholder}
                error={field.error}
                required={field.required}
              />
            ))}
            <ControllerSwitch control={control} field={switchField} />
            <div className="flex flex-col gap-1 pt-4">
              <div className="flex items-center gap-4">
                <Button variant="primary" size="lg" onClick={onSubmit} loading={isSubmitting} disabled={!isDirty}>
                  {isSubmitting ? "Saving" : "Save changes"}
                </Button>
                <Link href="/authentication" className={getButtonStyling("secondary", "lg")} onClick={handleGoBack}>
                  Go back
                </Link>
              </div>
            </div>
          </div>
          {serviceDetails}
        </div>
      </div>
    </>
  );
}

type OAuthServiceDetailsCardProps = {
  providerName: string;
  fields: TCopyField[];
  className?: string;
};

/** Single card of Plane-provided values the admin copies into the provider. */
export function OAuthServiceDetailsCard(props: OAuthServiceDetailsCardProps) {
  const { providerName, fields, className } = props;
  return (
    <div className="col-span-2 md:col-span-1">
      <div className={cn("flex flex-col gap-y-4 rounded-lg px-6 pt-1.5 pb-4", className)}>
        <div className="pt-2 text-18 font-medium">Plane-provided details for {providerName}</div>
        {fields.map((field) => (
          <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
        ))}
      </div>
    </div>
  );
}

type OAuthWebServiceDetailsProps = {
  providerName: string;
  commonFields: TCopyField[];
  webFields: TCopyField[];
};

/** Plane-provided values split into common details and web-specific details. */
export function OAuthWebServiceDetails(props: OAuthWebServiceDetailsProps) {
  const { providerName, commonFields, webFields } = props;
  return (
    <div className="col-span-2 flex flex-col gap-y-6 md:col-span-1">
      <div className="pt-2 text-18 font-medium">Plane-provided details for {providerName}</div>

      <div className="flex flex-col gap-y-4">
        {/* common service details */}
        <div className="flex flex-col gap-y-4 rounded-lg bg-layer-1 px-6 py-4">
          {commonFields.map((field) => (
            <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
          ))}
        </div>

        {/* web service details */}
        <div className="flex flex-col overflow-hidden rounded-lg">
          <div className="flex items-center gap-x-3 bg-layer-3 px-6 py-3 text-11 font-medium text-secondary uppercase">
            <Monitor className="h-3 w-3" />
            Web
          </div>
          <div className="flex flex-col gap-y-4 bg-layer-1 px-6 py-4">
            {webFields.map((field) => (
              <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
