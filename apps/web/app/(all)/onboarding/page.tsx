/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { OnboardingRoot } from "@/components/onboarding";
import { SessionBoundary } from "@/components/convex-core/identity/session-boundary";

export default function OnboardingPage() {
  return (
    <SessionBoundary>
      <div className="relative flex size-full overflow-hidden rounded-lg bg-canvas transition-all duration-300 ease-in-out">
        <div className="size-full flex-grow overflow-hidden p-2 transition-all duration-300 ease-in-out">
          <div className="shadow-md relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-subtle bg-surface-1">
            <OnboardingRoot />
          </div>
        </div>
      </div>
    </SessionBoundary>
  );
}
