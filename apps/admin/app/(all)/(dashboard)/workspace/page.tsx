/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AdminFormNavigationGuard, useAdminSession } from "@/providers/user.provider";
import { useState } from "react";
import Link from "next/link";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { Loader as LoaderIcon } from "lucide-react";
// types
import { Button, getButtonStyling } from "@plane/propel/button";
import { setPromiseToast } from "@plane/propel/toast";
import { Loader, ToggleSwitch } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
import { WorkspaceListItem } from "@/components/workspace/list-item";
// hooks
// types
import type { Route } from "./+types/page";

function WorkspaceManagementPage(_props: Route.ComponentProps) {
  const { authentication, authority } = useAdminSession();
  const allowed = authentication.isAuthenticated && authority?.isInstanceAdmin === true;
  // states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const configuration = useQuery(api.identity.instance.configuration.get, allowed ? {} : "skip");
  const savePolicy = useMutation(api.identity.instance.configuration.saveWorkspaceCreation);
  const {
    results: workspaces,
    status,
    loadMore,
  } = usePaginatedQuery(api.identity.instance.workspaces.list, allowed ? {} : "skip", { initialNumItems: 10 });
  const updateConfig = async (disabled: boolean) => {
    if (!allowed || !configuration || isSubmitting) return;
    setIsSubmitting(true);
    const promise = savePolicy({ expectedRevision: configuration.revision, disabled });
    setPromiseToast(promise, {
      loading: "Saving configuration",
      success: { title: "Success", message: () => "Configuration saved successfully" },
      error: { title: "Error", message: () => "Failed to save configuration" },
    });
    try {
      await promise;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AdminFormNavigationGuard pending={isSubmitting} />
      <PageWrapper
        header={{
          title: "Workspaces on this instance",
          description: "See all workspaces and control who can create them.",
        }}
      >
        <div className="space-y-3">
          {configuration ? (
            <div className={cn("flex w-full items-center gap-14 rounded-sm")}>
              <div className="flex grow items-center gap-4">
                <div className="grow">
                  <div className="pb-1 text-16 font-medium">Prevent anyone else from creating a workspace.</div>
                  <div className={cn("text-11 leading-5 font-regular text-tertiary")}>
                    Toggling this on will let only you create workspaces. You will have to invite users to new
                    workspaces.
                  </div>
                </div>
              </div>
              <div className={`shrink-0 pr-4 ${isSubmitting && "opacity-70"}`}>
                <div className="flex items-center gap-4">
                  <ToggleSwitch
                    value={configuration.isWorkspaceCreationDisabled}
                    onChange={() => {
                      void updateConfig(!configuration.isWorkspaceCreationDisabled).catch(() => {});
                    }}
                    size="sm"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          ) : (
            <Loader>
              <Loader.Item height="50px" width="100%" />
            </Loader>
          )}
          {status !== "LoadingFirstPage" ? (
            <>
              <div className="flex items-center justify-between gap-2 pt-6">
                <div className="flex flex-col items-start gap-x-2">
                  <div className="flex items-center gap-2 text-16 font-medium">
                    All workspaces on this instance{" "}
                    {status === "Exhausted" && <span className="text-tertiary">• {workspaces.length}</span>}
                    {status === "LoadingMore" && <LoaderIcon className="h-4 w-4 animate-spin" />}
                  </div>
                  <div className={cn("text-11 leading-5 font-regular text-tertiary")}>
                    You can&apos;t yet delete workspaces and you can only go to the workspace if you are an Admin or a
                    Member.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/workspace/create" className={getButtonStyling("primary", "base")}>
                    Create workspace
                  </Link>
                </div>
              </div>
              <div className="flex flex-col gap-4 py-2">
                {workspaces.map((workspace) => (
                  <WorkspaceListItem key={workspace._id} workspace={workspace} />
                ))}
              </div>
              {(status === "CanLoadMore" || status === "LoadingMore") && (
                <div className="flex justify-center">
                  <Button variant="link" size="lg" onClick={() => loadMore(10)} disabled={status === "LoadingMore"}>
                    Load more
                    {status === "LoadingMore" && <LoaderIcon className="h-3 w-3 animate-spin" />}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Loader className="space-y-10 py-8">
              <Loader.Item height="24px" width="20%" />
              <Loader.Item height="92px" width="100%" />
              <Loader.Item height="92px" width="100%" />
              <Loader.Item height="92px" width="100%" />
            </Loader>
          )}
        </div>
      </PageWrapper>
    </>
  );
}

export const meta: Route.MetaFunction = () => [{ title: "Workspace Management - God Mode" }];

export default WorkspaceManagementPage;
