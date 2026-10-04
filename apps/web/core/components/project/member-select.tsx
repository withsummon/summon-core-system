/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Ban } from "lucide-react";
import { CustomSearchSelect } from "@plane/ui";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import type { ProjectMember } from "./settings/member-columns";

export function MemberSelect({
  value,
  members,
  onChange,
  isDisabled = false,
  label,
}: {
  value: ProjectMember["userId"] | null;
  members: ProjectMember[];
  onChange: (value: ProjectMember["userId"] | null) => void;
  isDisabled?: boolean;
  label: string;
}) {
  const selected = members.find((member) => member.userId === value);
  return (
    <CustomSearchSelect
      value={value ?? "none"}
      ariaLabel={label}
      label={
        <div className="flex min-h-3.5 min-w-0 items-center gap-2">
          {selected?.avatar && (
            <AuthenticatedAssetImage
              asset={selected.avatar}
              alt="Member avatar"
              compactName={selected.displayName ?? selected.fullName}
              className="size-5 rounded-full"
            />
          )}
          {selected ? (
            <span className="min-w-0 truncate">{selected.displayName ?? selected.fullName}</span>
          ) : (
            <>
              <Ban className="size-3.5 rotate-90 text-placeholder" aria-hidden="true" />
              <span className="text-13 text-placeholder">{value === null ? "None" : "Unavailable member"}</span>
            </>
          )}
        </div>
      }
      buttonClassName="!px-3 !py-2 bg-surface-1"
      options={[
        ...members
          .filter((member) => member.role !== "guest" && member.workspaceRole !== "guest")
          .map((member) => ({
            value: member.userId,
            query: `${member.fullName} ${member.displayName ?? ""} ${member.email ?? ""}`,
            content: (
              <div className="flex items-center gap-2">
                {member.avatar && (
                  <AuthenticatedAssetImage
                    asset={member.avatar}
                    alt="Member avatar"
                    compactName={member.displayName ?? member.fullName}
                    className="size-5 rounded-full"
                  />
                )}
                {member.displayName ?? member.fullName}
              </div>
            ),
          })),
        {
          value: "none",
          query: "none",
          content: (
            <div className="flex items-center gap-2">
              <Ban className="size-3.5 rotate-90 text-placeholder" aria-hidden="true" />
              <span>None</span>
            </div>
          ),
        },
      ]}
      maxHeight="md"
      onChange={(selection: string) => {
        if (selection === "none") onChange(null);
        else {
          const choice = members.find((member) => member.userId === selection);
          if (choice) onChange(choice.userId);
        }
      }}
      disabled={isDisabled}
    />
  );
}
