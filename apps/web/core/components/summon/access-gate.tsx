/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import type { TSummonCapability } from "@plane/types";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonScreen } from "@/components/summon/screen";
import { useSummonAccess } from "@/components/summon/use-summon-access";

/** Renders a screen only for roles holding `capability`; everyone else gets a no-access state instead. */
export function SummonAccessGate(props: {
  workspaceSlug: string;
  capability: TSummonCapability;
  title: string;
  children: ReactNode;
}) {
  const { workspaceSlug, capability, title, children } = props;
  const { can, isLoading, error } = useSummonAccess(workspaceSlug);
  if (can(capability)) return children;

  return (
    <SummonScreen title={title} description="">
      <SummonRequestState
        loading={isLoading}
        error={error}
        permissionError={!isLoading && !error}
        permissionMessage={`Only workspace admins can open ${title}. Ask an admin if you need access.`}
      />
    </SummonScreen>
  );
}
