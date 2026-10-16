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

/** The Users tab's "Invite people" button and the dialog it opens. */
export function InvitePeopleAction(props: { workspaceSlug: string }) {
  const { workspaceSlug } = props;
  const [inviting, setInviting] = useState(false);
  const { mutate } = useSWRConfig();
  return (
    <>
      <Button size="lg" prependIcon={<UserPlusIcon />} onClick={() => setInviting(true)}>
        Invite people
      </Button>
      <InviteDialog
        workspaceSlug={workspaceSlug}
        open={inviting}
        onClose={() => setInviting(false)}
        onInvited={() => {
          void mutate(["summon-users", workspaceSlug]);
          void mutate(["summon-access-history", workspaceSlug]);
        }}
      />
    </>
  );
}
