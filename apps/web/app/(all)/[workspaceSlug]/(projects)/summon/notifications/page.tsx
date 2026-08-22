/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { observer } from "mobx-react";
import { NotificationsRoot } from "@/components/summon/notifications";
import type { Route } from "./+types/page";

function SummonNotificationsPage({ params }: Route.ComponentProps) {
  const workspaceSlug = params.workspaceSlug;
  return <NotificationsRoot workspaceSlug={workspaceSlug} />;
}

export default observer(SummonNotificationsPage);
