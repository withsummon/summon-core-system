/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { Loader } from "@plane/ui";

/** Placeholder for the work item title and description while the peek overview loads. */
export function PeekOverviewDetailsLoader() {
  return (
    <Loader className="px-6">
      <Loader.Item height="30px" />
      <div className="mt-3 space-y-2">
        <Loader.Item height="20px" width="70%" />
        <Loader.Item height="20px" width="60%" />
        <Loader.Item height="20px" width="60%" />
      </div>
    </Loader>
  );
}
