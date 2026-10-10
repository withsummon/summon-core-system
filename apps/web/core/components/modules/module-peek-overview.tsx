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
import { useModule } from "@/hooks/store/use-module";
import { useAppRouter } from "@/hooks/use-app-router";
// components
import { ModuleAnalyticsSidebar } from "./";

type Props = {
  projectId: string;
  workspaceSlug: string;
  isArchived?: boolean;
};

export const ModulePeekOverview = observer(function ModulePeekOverview({
  projectId,
  workspaceSlug,
  isArchived = false,
}: Props) {
  // router
  const router = useAppRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const peekModule = searchParams.get("peekModule");
  // Keep the last module rendered while the drawer animates out after the query param clears.
  const [shownModule, setShownModule] = useState(peekModule);
  if (peekModule && peekModule !== shownModule) setShownModule(peekModule);
  // store hooks
  const { fetchModuleDetails, fetchArchivedModuleDetails } = useModule();

  const handleClose = () => {
    const query = generateQueryParams(searchParams, ["peekModule"]);
    router.push(`${pathname}?${query}`);
  };

  useEffect(() => {
    if (!peekModule) return;
    if (isArchived) fetchArchivedModuleDetails(workspaceSlug, projectId, peekModule.toString());
    else fetchModuleDetails(workspaceSlug, projectId, peekModule.toString());
  }, [fetchArchivedModuleDetails, fetchModuleDetails, isArchived, peekModule, projectId, workspaceSlug]);

  return (
    <Drawer
      open={!!peekModule}
      modal={false}
      disablePointerDismissal
      onOpenChange={(open) => !open && handleClose()}
      onOpenChangeComplete={(open) => !open && setShownModule(null)}
    >
      <DrawerContent
        container={document.getElementById("full-screen-portal")}
        initialFocus={false}
        finalFocus={false}
        aria-label="Module details"
        className="vertical-scrollbar max-w-[24rem] gap-3.5 overflow-y-auto px-6"
      >
        {shownModule && (
          <ModuleAnalyticsSidebar moduleId={shownModule} handleClose={handleClose} isArchived={isArchived} />
        )}
      </DrawerContent>
    </Drawer>
  );
});
