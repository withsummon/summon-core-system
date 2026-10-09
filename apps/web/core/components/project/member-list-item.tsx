/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@summon/convex/api";
import { Table } from "@plane/ui";
import { useProjectColumns } from "@/components/projects/settings/useProjectColumns";
import type { ProjectMember } from "./settings/member-columns";
import { ConfirmProjectMemberRemove } from "./confirm-project-member-remove";

type Props = Parameters<typeof useProjectColumns>[0] & {
  members: ProjectMember[];
  projectName: string;
  beforeLeave: () => Promise<void>;
};
export function ProjectMemberListItem({ members, projectName, beforeLeave, ...props }: Props) {
  const navigate = useNavigate();
  const revoke = useMutation(api.projects.index.revokeMember);
  const leave = useMutation(api.projects.index.leave);
  const { columns, removeMemberModal: selected, setRemoveMemberModal } = useProjectColumns(props);
  return (
    <>
      {selected && (
        <ConfirmProjectMemberRemove
          member={selected}
          projectName={projectName}
          onClose={() => setRemoveMemberModal(null)}
          onSuccess={() => {
            if (selected.canLeave) navigate(`/${props.workspaceSlug}/projects`);
          }}
          onSubmit={async () => {
            if (selected.canLeave) {
              await beforeLeave();
              await leave({ projectId: props.projectId });
            } else
              await revoke({
                projectId: props.projectId,
                userId: selected.userId,
                expectedRevision: selected.revision,
              });
          }}
        />
      )}
      <Table<ProjectMember>
        columns={columns}
        data={members}
        keyExtractor={(member) => member.membershipId}
        tHeadClassName="border-b border-subtle"
        thClassName="text-left font-medium divide-x-0 text-placeholder"
        tBodyClassName="divide-y-0"
        tBodyTrClassName="divide-x-0 p-4 h-10 text-secondary"
        tHeadTrClassName="divide-x-0"
      />
    </>
  );
}
