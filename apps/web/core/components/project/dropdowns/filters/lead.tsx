/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, type ReactNode } from "react";
import { sortBy } from "lodash-es";
import { observer } from "mobx-react";
import { Avatar, Loader } from "@plane/ui";
import { getFileURL } from "@plane/utils";
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (value: string) => void;
  memberIds: string[] | undefined;
  searchQuery: string;
};
export type ProjectMemberFilterOption = { value: string; label: string; icon: ReactNode };

export const FilterLead = observer(function FilterLead({ memberIds, ...props }: Props) {
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
  return <ProjectMemberFilterView {...props} title="Lead" options={options} currentUserId={currentUser?.id} />;
});

export function ProjectMemberFilterView({
  appliedFilters,
  handleUpdate,
  searchQuery,
  title,
  options,
  currentUserId,
}: Omit<Props, "memberIds"> & {
  title: string;
  options: readonly ProjectMemberFilterOption[] | undefined;
  currentUserId: string | undefined;
}) {
  const [showAll, setShowAll] = useState(false);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const count = appliedFilters?.length ?? 0;
  const sorted =
    options === undefined
      ? undefined
      : sortBy(
          options.filter((option) => option.label.toLowerCase().includes(searchQuery.toLowerCase())),
          [
            (option) => !appliedFilters?.includes(option.value),
            (option) => option.value !== currentUserId,
            (option) => option.label.toLowerCase(),
          ]
        );
  return (
    <>
      <FilterHeader
        title={`${title}${count > 0 ? ` (${count})` : ""}`}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {sorted === undefined ? (
            <Loader className="space-y-2">
              <Loader.Item height="20px" />
              <Loader.Item height="20px" />
              <Loader.Item height="20px" />
            </Loader>
          ) : sorted.length === 0 ? (
            <p className="text-11 text-placeholder italic">No matches found</p>
          ) : (
            <>
              {(showAll ? sorted : sorted.slice(0, 5)).map((option) => (
                <FilterOption
                  key={option.value}
                  isChecked={appliedFilters?.includes(option.value) === true}
                  onClick={() => handleUpdate(option.value)}
                  icon={option.icon}
                  title={currentUserId === option.value ? "You" : option.label}
                />
              ))}
              {sorted.length > 5 && (
                <button
                  type="button"
                  className="ml-8 text-11 font-medium text-accent-primary"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? "View less" : "View all"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
