/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useSWRConfig } from "swr";
import { UserPlusIcon } from "@phosphor-icons/react";
import { Button } from "@plane/propel/button";
import { InviteDialog } from "@/components/summon/settings/invite-dialog";
import { SummonSettingsFrame } from "@/components/summon/settings/settings-frame";
import { SummonUsersRoot } from "@/components/summon/settings/users-root";
import type { Route } from "./+types/page";

export default function SummonUsersPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const [inviting, setInviting] = useState(false);
  const { mutate } = useSWRConfig();

  return (
    <SummonSettingsFrame
      workspaceSlug={workspaceSlug}
      tab="users"
      description="Who can sign in to this workspace, and what their role lets them do."
      actions={
        <Button size="lg" prependIcon={<UserPlusIcon />} onClick={() => setInviting(true)}>
          Invite people
        </Button>
      }
    >
      <SummonUsersRoot workspaceSlug={workspaceSlug} />
      <InviteDialog
        workspaceSlug={workspaceSlug}
        open={inviting}
        onClose={() => setInviting(false)}
        onInvited={() => {
          void mutate(["summon-users", workspaceSlug]);
          void mutate(["summon-access-history", workspaceSlug]);
        }}
      />
    </SummonSettingsFrame>
  );
}
