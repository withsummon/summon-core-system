/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ClientDetailRoot } from "@/components/summon/clients";
import type { Route } from "./+types/page";

export default function SummonClientDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, clientId } = params;
  return <ClientDetailRoot clientId={clientId} workspaceSlug={workspaceSlug} />;
}
