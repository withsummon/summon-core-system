/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext, useParams } from "react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { CycleDetails } from "@/components/convex-core/cycles/detail";

export default function CycleDetailPage() {
  const address = useOutletContext<FunctionReturnType<typeof api.navigation.address.resolveProjectId>>();
  const { cycleId } = useParams();
  return cycleId ? (
    <CycleDetails key={cycleId} address={address} cycleId={cycleId} />
  ) : (
    <p role="alert">Cycle unavailable.</p>
  );
}
