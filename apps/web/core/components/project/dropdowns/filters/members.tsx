/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Avatar } from "@plane/ui";
import { getFileURL } from "@plane/utils";
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";
import { ProjectMemberFilterView } from "./lead";

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (value: string) => void;
  memberIds: string[] | undefined;
  searchQuery: string;
};
export const FilterMembers = observer(function FilterMembers({ memberIds, ...props }: Props) {
  const { getUserDetails } = useMember();
  const { data: currentUser } = useUser();
  const options = memberIds
    ?.map((id) => {
      const member = getUserDetails(id);
      return member
        ? {
            value: member.id,
            label: member.display_name,
            icon: (
              <Avatar name={member.display_name} src={getFileURL(member.avatar_url)} showTooltip={false} size="md" />
            ),
          }
        : null;
    })
    .filter((option) => option !== null);
  return <ProjectMemberFilterView {...props} title="Members" options={options} currentUserId={currentUser?.id} />;
});
