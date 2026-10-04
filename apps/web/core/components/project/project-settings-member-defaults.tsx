/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { ToggleSwitch } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { MembersSettingsLoader } from "@/components/ui/loader/settings/members";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { MemberSelect } from "./member-select";

function DefaultSettingItem({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-x-2">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-13 font-medium">{title}</h4>
        <p className="text-11 text-tertiary">{description}</p>
      </div>
      <div className="w-full max-w-48 sm:max-w-64">{children}</div>
    </div>
  );
}
export function ProjectSettingsMemberDefaults({
  projectId,
}: {
  projectId: FunctionArgs<typeof api.projects.settings.memberDefaults>["projectId"];
}) {
  const defaults = useQuery(api.projects.settings.memberDefaults, { projectId });
  const directory = useQuery(api.projects.index.members, { projectId });
  const save = useMutation(api.projects.settings.saveMemberDefaults);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useReloadConfirmations(pending, "The project member defaults are still being saved.", undefined, pending);
  const submit = async (
    fields: Pick<
      FunctionArgs<typeof api.projects.settings.saveMemberDefaults>,
      "leadId" | "defaultAssigneeId" | "guestViewAllFeatures"
    >
  ) => {
    if (!defaults) return;
    setPending(true);
    setError("");
    try {
      await save({ projectId, expectedRevision: defaults.revision, ...fields });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success!", message: "Project settings updated." });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  if (!defaults || !directory) return <MembersSettingsLoader />;
  const disabled = pending || !defaults.canManage;
  return (
    <div className="my-6 flex flex-col gap-y-6">
      <DefaultSettingItem title="Project Lead" description="Select the project lead for the project.">
        <MemberSelect
          value={defaults.leadId}
          members={directory.members}
          label="Project lead"
          onChange={(leadId) => void submit({ leadId })}
          isDisabled={disabled}
        />
      </DefaultSettingItem>
      <DefaultSettingItem title="Default Assignee" description="Select the default assignee for the project.">
        <MemberSelect
          value={defaults.defaultAssigneeId}
          members={directory.members}
          label="Default assignee"
          onChange={(defaultAssigneeId) => void submit({ defaultAssigneeId })}
          isDisabled={disabled}
        />
      </DefaultSettingItem>
      {defaults.defaultAssigneeId !== null && !defaults.defaultAssigneeEligible && (
        <p role="status" className="text-11 text-tertiary">
          The saved default assignee is unavailable. New work items will be unassigned until an eligible member is
          selected.
        </p>
      )}
      <DefaultSettingItem
        title="Guest access"
        description="This will allow guests to have view access to all the project work items."
      >
        <div className="flex items-center justify-end">
          <ToggleSwitch
            label="Guest access"
            value={defaults.guestViewAllFeatures}
            onChange={() => void submit({ guestViewAllFeatures: !defaults.guestViewAllFeatures })}
            disabled={disabled}
            size="sm"
          />
        </div>
      </DefaultSettingItem>
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
