/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Outlet } from "react-router";
// hooks
import { useAdminSession } from "@/providers/user.provider";

function RootLayout() {
  // router
  const { replace } = useRouter();
  // store hooks
  const { authority } = useAdminSession();

  useEffect(() => {
    if (authority?.isInstanceAdmin) replace("/general");
  }, [replace, authority?.isInstanceAdmin]);

  return (
    <div className="relative z-10 flex h-screen w-screen flex-col items-center overflow-hidden overflow-y-auto bg-surface-1 px-8 pt-6 pb-10">
      <Outlet />
    </div>
  );
}

export default RootLayout;
