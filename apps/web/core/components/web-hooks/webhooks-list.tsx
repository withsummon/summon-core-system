/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { NativeWorkspace } from "@/components/workspace/native-shell/session";
import { WebhooksListItem } from "./webhooks-list-item";

export function WebhooksList({
  workspace,
  webhooks,
}: {
  workspace: NativeWorkspace;
  webhooks: FunctionReturnType<typeof api.webhooks.index.list>["page"];
}) {
  return (
    <div className="flex size-full flex-col gap-y-2 overflow-y-auto rounded-lg border border-subtle bg-layer-1 p-3">
      {webhooks.map((webhook) => (
        <WebhooksListItem key={webhook._id} workspace={workspace} webhook={webhook} />
      ))}
    </div>
  );
}
