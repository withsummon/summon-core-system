/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Controller, useFormContext } from "react-hook-form";
import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { memberLabel } from "@summon/convex/member-label";
// plane imports
import { NETWORK_CHOICES, ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { CustomSelect } from "@plane/ui";
import { getTabIndex } from "@plane/utils";
// components
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { ProjectNetworkIcon } from "@/components/project/project-network-icon";

type Props = {
  isMobile?: boolean;
};

function ProjectAttributes(props: Props) {
  const { isMobile = false } = props;
  const { t } = useTranslation();
  const { control } = useFormContext<IProject>();
  const { getIndex } = getTabIndex(ETabIndices.PROJECT_CREATE, isMobile);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Controller
        name="network"
        control={control}
        render={({ field: { onChange, value } }) => {
          const currentNetwork = NETWORK_CHOICES.find((n) => n.key === value);

          return (
            <div className="h-7 flex-shrink-0" tabIndex={getIndex("network")}>
              <CustomSelect
                value={value}
                onChange={onChange}
                label={
                  <div className="flex h-full items-center gap-1">
                    {currentNetwork ? (
                      <>
                        <ProjectNetworkIcon iconKey={currentNetwork.iconKey} />
                        {t(currentNetwork.i18n_label)}
                      </>
                    ) : (
                      <span className="text-placeholder">{t("select_network")}</span>
                    )}
                  </div>
                }
                placement="bottom-start"
                className="h-full"
                buttonClassName="h-full"
                noChevron
                tabIndex={getIndex("network")}
              >
                {NETWORK_CHOICES.map((network) => (
                  <CustomSelect.Option key={network.key} value={network.key}>
                    <div className="flex items-start gap-2">
                      <ProjectNetworkIcon iconKey={network.iconKey} className="h-3.5 w-3.5" />
                      <div className="-mt-1">
                        <p>{t(network.i18n_label)}</p>
                        <p className="text-11 text-placeholder">{t(network.description)}</p>
                      </div>
                    </div>
                  </CustomSelect.Option>
                ))}
              </CustomSelect>
            </div>
          );
        }}
      />
      <Controller
        name="project_lead"
        control={control}
        render={({ field: { value, onChange } }) => {
          if (value === undefined || value === null || typeof value === "string")
            return (
              <div className="h-7 flex-shrink-0" tabIndex={getIndex("lead")}>
                <MemberDropdown
                  value={value ?? null}
                  onChange={(lead) => onChange(lead === value ? null : lead)}
                  placeholder={t("lead")}
                  multiple={false}
                  buttonVariant="border-with-text"
                  tabIndex={getIndex("lead")}
                />
              </div>
            );
          else return <></>;
        }}
      />
    </div>
  );
}

export default ProjectAttributes;

export { ProjectAttributes };

export function NativeProjectAttributes({
  value,
  onChange,
  canCreate,
  disabled,
}: {
  value: FunctionArgs<typeof api.projects.index.create>;
  onChange: (fields: Partial<FunctionArgs<typeof api.projects.index.create>>) => void;
  canCreate: boolean;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const people = useQuery(
    api.workspaces.index.members,
    canCreate ? { workspaceId: value.workspaceId, roles: ["admin", "member"] } : "skip"
  );
  const selectedNetwork = NETWORK_CHOICES.find((choice) => choice.key === value.network);
  const selectedLead = people?.members.find((person) => person.userId === value.leadId);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CustomSelect<NonNullable<FunctionArgs<typeof api.projects.index.create>["network"]>>
        value={value.network}
        disabled={disabled}
        ariaLabel={t("select_network")}
        onChange={(network) => {
          if (network !== null) onChange({ network });
        }}
        label={
          selectedNetwork ? (
            <span className="flex items-center gap-1">
              <ProjectNetworkIcon iconKey={selectedNetwork.iconKey} />
              {t(selectedNetwork.i18n_label)}
            </span>
          ) : (
            t("select_network")
          )
        }
      >
        {NETWORK_CHOICES.map((choice) => (
          <CustomSelect.Option key={choice.key} value={choice.key}>
            <div className="flex items-start gap-2">
              <ProjectNetworkIcon iconKey={choice.iconKey} className="h-3.5 w-3.5" />
              <div>
                <p>{t(choice.i18n_label)}</p>
                <p className="text-11 text-placeholder">{t(choice.description)}</p>
              </div>
            </div>
          </CustomSelect.Option>
        ))}
      </CustomSelect>
      <CustomSelect<NonNullable<FunctionArgs<typeof api.projects.index.create>["leadId"]> | null>
        value={value.leadId ?? null}
        disabled={disabled || people === undefined}
        ariaLabel={t("lead")}
        onChange={(leadId) => onChange({ leadId })}
        label={
          selectedLead
            ? memberLabel({ id: selectedLead.userId, name: selectedLead.displayName, email: selectedLead.email })
            : t("lead")
        }
      >
        <CustomSelect.Option value={null}>None</CustomSelect.Option>
        {people?.members.map((person) => (
          <CustomSelect.Option key={person.userId} value={person.userId}>
            {memberLabel({ id: person.userId, name: person.displayName, email: person.email })}
          </CustomSelect.Option>
        ))}
      </CustomSelect>
    </div>
  );
}
