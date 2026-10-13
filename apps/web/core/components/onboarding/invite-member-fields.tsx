/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import { observer } from "mobx-react";
import type {
  Control,
  FieldArrayWithId,
  FieldErrors,
  UseFieldArrayRemove,
  UseFormGetValues,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import { Controller } from "react-hook-form";
import { XCircle } from "lucide-react";
// plane imports
import type { EUserPermissions } from "@plane/constants";
import { ROLE, ROLE_DETAILS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { PlusIcon } from "@plane/propel/icons";
import { CustomSelect, Input } from "@plane/ui";
import { cn } from "@plane/utils";

type EmailRole = {
  email: string;
  role: EUserPermissions;
  role_active: boolean;
};

export type TInviteMembersFormValues = {
  emails: EmailRole[];
};

type TInviteMemberFormControls = {
  control: Control<TInviteMembersFormValues>;
  setValue: UseFormSetValue<TInviteMembersFormValues>;
  getValues: UseFormGetValues<TInviteMembersFormValues>;
  watch: UseFormWatch<TInviteMembersFormValues>;
  fields: FieldArrayWithId<TInviteMembersFormValues, "emails", "id">[];
  remove: UseFieldArrayRemove;
  errors: FieldErrors<TInviteMembersFormValues>;
  isInvitationDisabled: boolean;
  setIsInvitationDisabled: (value: boolean) => void;
  /** Extra classes for the email column of each row. */
  emailColumnClassName?: string;
};

type InviteMemberInputProps = TInviteMemberFormControls & {
  index: number;
};

const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const placeholderEmails = [
  "charlie.taylor@frstflt.com",
  "octave.chanute@frstflt.com",
  "george.spratt@frstflt.com",
  "frank.coffyn@frstflt.com",
  "amos.root@frstflt.com",
  "edward.deeds@frstflt.com",
  "charles.m.manly@frstflt.com",
  "glenn.curtiss@frstflt.com",
  "thomas.selfridge@frstflt.com",
  "albert.zahm@frstflt.com",
];

const InviteMemberInput = observer(function InviteMemberInput(props: InviteMemberInputProps) {
  const {
    control,
    index,
    fields,
    remove,
    errors,
    isInvitationDisabled,
    setIsInvitationDisabled,
    setValue,
    getValues,
    watch,
    emailColumnClassName,
  } = props;

  const { t } = useTranslation();

  const email = watch(`emails.${index}.email`);

  const emailOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value === "") {
      const validEmail = fields.map((_, i) => emailRegex.test(getValues(`emails.${i}.email`))).includes(true);
      if (validEmail) {
        setIsInvitationDisabled(false);
      } else {
        setIsInvitationDisabled(true);
      }

      if (getValues(`emails.${index}.role_active`)) {
        setValue(`emails.${index}.role_active`, false);
      }
    } else {
      if (!getValues(`emails.${index}.role_active`)) {
        setValue(`emails.${index}.role_active`, true);
      }
      if (isInvitationDisabled && emailRegex.test(event.target.value)) {
        setIsInvitationDisabled(false);
      } else if (!isInvitationDisabled && !emailRegex.test(event.target.value)) {
        setIsInvitationDisabled(true);
      }
    }
  };

  return (
    <div>
      <div className="group relative grid grid-cols-10 gap-4">
        <div className={cn("col-span-6", emailColumnClassName)}>
          <Controller
            control={control}
            name={`emails.${index}.email`}
            rules={{
              pattern: {
                value: emailRegex,
                message: "Invalid Email ID",
              },
            }}
            render={({ field: { value, onChange, ref } }) => (
              <Input
                id={`emails.${index}.email`}
                name={`emails.${index}.email`}
                type="text"
                value={value}
                onChange={(event) => {
                  emailOnChange(event);
                  onChange(event);
                }}
                ref={ref}
                hasError={Boolean(errors.emails?.[index]?.email)}
                placeholder={placeholderEmails[index % placeholderEmails.length]}
                className="w-full border-strong text-11 placeholder:text-placeholder sm:text-13"
                autoComplete="off"
              />
            )}
          />
        </div>
        <div className="col-span-4 mr-8">
          <Controller
            control={control}
            name={`emails.${index}.role`}
            rules={{ required: true }}
            render={({ field: { value, onChange } }) => (
              <CustomSelect
                value={value}
                label={ROLE[value]}
                input
                className="w-full"
                placement="bottom-end"
                buttonClassName={!getValues(`emails.${index}.role_active`) ? "text-placeholder" : "text-primary"}
                onChange={(val: EUserPermissions) => {
                  onChange(val);
                  setValue(`emails.${index}.role_active`, true);
                }}
              >
                {Object.entries(ROLE_DETAILS).map(([key, role]) => (
                  <CustomSelect.Option key={key} value={parseInt(key)}>
                    <div className="flex flex-col gap-1 p-1 text-wrap">
                      <span className="text-13 font-medium">{t(role.i18n_title)}</span>
                      <span className="text-11 text-tertiary">{t(role.i18n_description)}</span>
                    </div>
                  </CustomSelect.Option>
                ))}
              </CustomSelect>
            )}
          />
        </div>
        {fields.length > 1 && (
          <button
            type="button"
            aria-label="Remove"
            className="absolute right-0 hidden place-items-center self-center rounded-sm group-hover:grid"
            onClick={() => remove(index)}
          >
            <XCircle className="h-5 w-5 pl-0.5 text-placeholder" />
          </button>
        )}
      </div>
      {email && !emailRegex.test(email) && (
        <div className="mx-8 my-1">
          <span className="text-13">🤥</span>{" "}
          <span className="mt-1 text-11 text-danger-primary">That doesn{"'"}t look like an email address.</span>
        </div>
      )}
    </div>
  );
});

type InviteMemberFieldsProps = TInviteMemberFormControls & {
  onAddField: () => void;
};

/** Email + role rows used by the onboarding "Invite your teammates" steps. */
export function InviteMemberFields(props: InviteMemberFieldsProps) {
  const { onAddField, ...controls } = props;

  return (
    <div className="w-full py-4 text-13">
      <div className="group relative mx-8 grid grid-cols-10 gap-4 py-2">
        <div className="col-span-6 px-1 text-13 font-medium text-secondary">Email</div>
        <div className="col-span-4 px-1 text-13 font-medium text-secondary">Role</div>
      </div>
      <div className="mb-3 space-y-3 sm:space-y-4">
        {controls.fields.map((field, index) => (
          <InviteMemberInput key={field.id} {...controls} index={index} />
        ))}
      </div>
      <button
        type="button"
        className="mx-8 flex items-center gap-1.5 bg-transparent text-13 font-medium text-accent-primary outline-accent-strong"
        onClick={onAddField}
      >
        <PlusIcon className="h-4 w-4" strokeWidth={2} />
        Add another
      </button>
    </div>
  );
}
