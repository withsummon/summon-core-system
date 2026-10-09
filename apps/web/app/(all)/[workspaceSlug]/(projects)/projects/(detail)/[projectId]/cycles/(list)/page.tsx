/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext, useSearchParams } from "react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { ProjectCycles } from "@/components/convex-core/cycles/list";

export default function ProjectCyclesPage() {
  const address = useOutletContext<FunctionReturnType<typeof api.navigation.address.resolveProjectId>>();
  const [params, setParams] = useSearchParams();
  return (
    <ProjectCycles
      address={address}
      view={params.get("cycleView") === "trash" ? "trash" : "all"}
      onCreate={() =>
        setParams((current) => {
          const next = new URLSearchParams(current);
          next.set("createCycle", "1");
          return next;
        })
      }
    />
  );
}
