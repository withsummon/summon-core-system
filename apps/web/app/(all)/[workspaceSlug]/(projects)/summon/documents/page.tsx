/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { DocumentsRoot } from "@/components/summon/documents";
import type { Route } from "./+types/page";

export default function SummonDocumentsPage({ params }: Route.ComponentProps) {
  const workspaceSlug = params.workspaceSlug;
  return <DocumentsRoot workspaceSlug={workspaceSlug} />;
}
