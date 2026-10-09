/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
// components
import { AdminHeader } from "@/components/common/header";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { NewUserPopup } from "@/components/common/new-user-popup";
// hooks
import { useAdminSession } from "@/providers/user.provider";
import { InstanceSignInForm } from "../(home)/sign-in-form";
// local components
import type { Route } from "./+types/layout";
import { AdminSidebar } from "./sidebar";
import { AdminSidebarDropdown } from "./sidebar-dropdown";

function AdminLayout(_props: Route.ComponentProps) {
  const { authentication, authority } = useAdminSession();
  const allowed = authentication.isAuthenticated && authority?.isInstanceAdmin === true;
  return (
    <>
      {!allowed &&
        (authentication.isLoading || (authentication.isAuthenticated && authority === undefined) ? (
          <div className="flex h-screen items-center justify-center">
            <LogoSpinner />
          </div>
        ) : !authentication.isAuthenticated ? (
          <div className="flex min-h-screen flex-col items-center p-8">
            <InstanceSignInForm />
          </div>
        ) : (
          <div role="alert" className="p-8">
            <AdminSidebarDropdown />
            <p className="mt-4">
              This account cannot administer the instance. Your draft is retained while this page remains open.
            </p>
          </div>
        ))}
      <div hidden={!allowed}>
        <div className="relative flex h-screen w-screen overflow-hidden">
          <AdminSidebar />
          <main className="relative flex h-full w-full flex-col overflow-hidden bg-surface-1">
            <AdminHeader />
            <fieldset
              disabled={!allowed}
              className="vertical-scrollbar scrollbar-md h-full w-full overflow-hidden overflow-y-scroll"
            >
              <Outlet />
            </fieldset>
          </main>
          <NewUserPopup />
        </div>
      </div>
    </>
  );
}

export default AdminLayout;
