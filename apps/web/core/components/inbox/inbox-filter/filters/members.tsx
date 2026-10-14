/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane types
import type { TInboxIssueFilterMemberKeys } from "@plane/types";
// components
import { MemberFilter } from "@/components/common/filters/member-filter";
// hooks
import { useProjectInbox } from "@/hooks/store/use-project-inbox";

type Props = {
  filterKey: TInboxIssueFilterMemberKeys;
  label?: string;
  memberIds: string[] | undefined;
  searchQuery: string;
};

export const FilterMember = observer(function FilterMember(props: Props) {
  const { filterKey, label = "Members", memberIds, searchQuery } = props;
  // hooks
  const { inboxFilters, handleInboxIssueFilters } = useProjectInbox();
  // derived values
  const filterValue = inboxFilters?.[filterKey] || [];

  const handleUpdate = (value: string) =>
    handleInboxIssueFilters(
      filterKey,
      filterValue.includes(value) ? filterValue.filter((v) => v !== value) : [...filterValue, value]
    );

  return (
    <MemberFilter
      title={label}
      appliedFilters={filterValue}
      handleUpdate={handleUpdate}
      memberIds={memberIds}
      searchQuery={searchQuery}
    />
  );
});
