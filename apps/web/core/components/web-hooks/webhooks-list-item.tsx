/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { ToggleSwitch } from "@plane/ui";
import type { NativeWorkspace } from "@/components/workspace/native-shell/session";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

type Props = {
  workspace: NativeWorkspace;
  webhook: FunctionReturnType<typeof api.webhooks.index.list>["page"][number];
};
export function WebhooksListItem({ workspace, webhook }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = useMutation(api.webhooks.index.setActive);
  useReloadConfirmations(pending, "Wait for the webhook update to finish.", undefined, pending);
  return (
    <div className="rounded-lg border border-subtle bg-layer-2 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <Link
          to={`/${workspace.slug}/settings/webhooks/${webhook._id}`}
          className="min-w-0 flex-1 truncate text-body-sm-medium"
        >
          {webhook.url}
        </Link>
        <ToggleSwitch
          aria-label={`Enable webhook ${webhook.url}`}
          value={webhook.isActive}
          disabled={pending || workspace.membershipRole !== "admin"}
          onChange={async (isActive) => {
            setPending(true);
            setError(null);
            try {
              await update({
                workspaceId: workspace._id,
                webhookId: webhook._id,
                expectedRevision: webhook.revision,
                isActive,
              });
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
            }
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-13 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
