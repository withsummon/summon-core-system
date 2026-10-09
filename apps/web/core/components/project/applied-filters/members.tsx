/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { CloseIcon } from "@plane/propel/icons";
import { Avatar } from "@plane/ui";
import { getFileURL } from "@plane/utils";
import { useMember } from "@/hooks/store/use-member";
import type { ProjectMemberFilterOption } from "../dropdowns/filters/lead";

type Props = {
  handleRemove: (value: string) => void;
  values: string[];
  editable: boolean | undefined;
};
export const AppliedMembersFilters = observer(function AppliedMembersFilters(props: Props) {
  const {
    workspace: { getWorkspaceMemberDetails },
  } = useMember();
  const options = props.values
    .map((id) => {
      const member = getWorkspaceMemberDetails(id)?.member;
      return member
        ? {
            value: id,
            label: member.display_name,
            icon: (
              <Avatar name={member.display_name} src={getFileURL(member.avatar_url)} showTooltip={false} size="sm" />
            ),
          }
        : null;
    })
    .filter((option) => option !== null);
  return <AppliedMembersFiltersView {...props} options={options} />;
});

export function AppliedMembersFiltersView({
  handleRemove,
  values,
  editable,
  options,
}: Props & { options: readonly ProjectMemberFilterOption[] }) {
  return (
    <>
      {values.map((id) => {
        const option = options.find((member) => member.value === id);
        if (!option) return null;
        return (
          <div key={id} className="flex items-center gap-1 rounded-sm bg-layer-1 px-1.5 py-1 text-11">
            {option.icon}
            <span className="normal-case">{option.label}</span>
            {editable && (
              <button
                type="button"
                className="grid place-items-center text-tertiary hover:text-secondary"
                aria-label={`Remove ${option.label} filter`}
                onClick={() => handleRemove(id)}
              >
                <CloseIcon height={10} width={10} strokeWidth={2} />
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
