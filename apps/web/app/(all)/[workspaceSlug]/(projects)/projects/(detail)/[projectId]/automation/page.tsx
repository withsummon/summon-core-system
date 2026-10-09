/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useOutletContext } from "react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { AutomationRootView } from "@/components/automation";
export default function ProjectAutomationPage() {
  const address = useOutletContext<FunctionReturnType<typeof api.navigation.address.resolveProjectId>>();
  return <AutomationRootView address={address} />;
}
