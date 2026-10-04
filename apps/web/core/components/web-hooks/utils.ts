/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { NativeWorkspace } from "@/components/workspace/native-shell/session";

export const getCurrentHookAsCSV = (
  workspace: NativeWorkspace,
  webhook: FunctionReturnType<typeof api.webhooks.index.get>,
  secretKey: string
) => ({
  id: webhook._id,
  url: webhook.url,
  created_at: new Date(webhook._creationTime).toISOString(),
  updated_at: new Date(webhook.updatedAt).toISOString(),
  is_active: webhook.isActive.toString(),
  secret_key: secretKey,
  project: webhook.events.includes("project").toString(),
  issue: webhook.events.includes("issue").toString(),
  module: webhook.events.includes("module").toString(),
  cycle: webhook.events.includes("cycle").toString(),
  issue_comment: webhook.events.includes("issue_comment").toString(),
  workspace: workspace.name,
});
