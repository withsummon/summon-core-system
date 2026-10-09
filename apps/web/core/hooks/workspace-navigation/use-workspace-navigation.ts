import { useCallback } from "react";
import type { IWorkspace } from "@plane/types";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { useUserProfile } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { selectWorkspaceAndNavigate } from "./selection";

export function useWorkspaceNavigation() {
  const { selectWorkspace } = useUserProfile();
  const router = useAppRouter();
  return useCallback(
    async (workspace: Pick<IWorkspace, "id" | "slug">) => {
      try {
        await selectWorkspaceAndNavigate(workspace, selectWorkspace, (href) => router.push(href));
        return true;
      } catch {
        setToast({ type: TOAST_TYPE.ERROR, title: "Could not switch workspace", message: "Please try again." });
        return false;
      }
    },
    [router, selectWorkspace]
  );
}
