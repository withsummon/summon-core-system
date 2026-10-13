/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Loader } from "@plane/ui";

/** Skeleton lines for a rich-text description while it loads. */
export function DescriptionLoader() {
  return (
    <div className="space-y-1">
      <Loader.Item width="300px" height="15px" />
      <Loader.Item width="400px" height="15px" />
      <div className="flex items-center gap-2">
        <Loader.Item width="20px" height="15px" />
        <Loader.Item width="500px" height="15px" />
      </div>
      <div className="flex items-center gap-2">
        <Loader.Item width="20px" height="15px" />
        <Loader.Item width="200px" height="15px" />
      </div>
      <Loader.Item width="300px" height="15px" />
      <Loader.Item width="200px" height="15px" />
    </div>
  );
}
