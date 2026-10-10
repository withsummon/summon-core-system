/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { usePathname, useSearchParams } from "next/navigation";
// hooks
import { Drawer, DrawerContent } from "@plane/propel/drawer";
import { generateQueryParams } from "@plane/utils";
import { useCycle } from "@/hooks/store/use-cycle";
import { useAppRouter } from "@/hooks/use-app-router";
// components
import { CycleDetailsSidebar } from "./analytics-sidebar";

type Props = {
  projectId?: string;
  workspaceSlug: string;
  isArchived?: boolean;
};

export const CyclePeekOverview = observer(function CyclePeekOverview(props: Props) {
  const { projectId: propsProjectId, workspaceSlug, isArchived } = props;
  // router
  const router = useAppRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const peekCycle = searchParams.get("peekCycle");
  // Keep the last cycle rendered while the drawer animates out after the query param clears.
  const [shownCycle, setShownCycle] = useState(peekCycle);
  if (peekCycle && peekCycle !== shownCycle) setShownCycle(peekCycle);
  // store hooks
  const { getCycleById, fetchCycleDetails, fetchArchivedCycleDetails } = useCycle();
  // derived values
  const cycleDetails = shownCycle ? getCycleById(shownCycle) : undefined;
  const projectId = propsProjectId || cycleDetails?.project_id;

  const handleClose = () => {
    const query = generateQueryParams(searchParams, ["peekCycle"]);
    router.push(`${pathname}?${query}`);
  };

  useEffect(() => {
    if (!peekCycle || !projectId) return;
    if (isArchived) fetchArchivedCycleDetails(workspaceSlug, projectId, peekCycle.toString());
    else fetchCycleDetails(workspaceSlug, projectId, peekCycle.toString());
  }, [fetchArchivedCycleDetails, fetchCycleDetails, isArchived, peekCycle, projectId, workspaceSlug]);

  return (
    <Drawer
      open={!!peekCycle && !!projectId}
      modal={false}
      disablePointerDismissal
      onOpenChange={(open) => !open && handleClose()}
      onOpenChangeComplete={(open) => !open && setShownCycle(null)}
    >
      <DrawerContent
        container={document.getElementById("full-screen-portal")}
        initialFocus={false}
        finalFocus={false}
        aria-label={cycleDetails?.name ?? "Cycle details"}
        className="vertical-scrollbar max-w-[21.5rem] gap-3.5 overflow-y-auto px-4"
      >
        {shownCycle && projectId && (
          <CycleDetailsSidebar
            handleClose={handleClose}
            isArchived={isArchived}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
            cycleId={shownCycle}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
});
