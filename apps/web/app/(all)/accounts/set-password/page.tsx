/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Link } from "react-router";
import { SessionBoundary } from "@/components/convex-core/identity/session-boundary";
import { AccountPassword } from "@/components/convex-core/identity/password/password";
import { AuthScreen } from "@/components/auth-screens/auth-screen";
import { AuthHeaderBase } from "@/components/auth-screens/header";

export default function SetPasswordPage() {
  return (
    <SessionBoundary>
      <AuthScreen header={<AuthHeaderBase pageTitle="Set password" />}>
        <div className="mx-auto w-full max-w-md space-y-6 py-12">
          <AccountPassword />
          <Link to="/" className="text-13 text-accent-primary">
            Continue to your workspace
          </Link>
        </div>
      </AuthScreen>
    </SessionBoundary>
  );
}
