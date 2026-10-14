/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Loader } from "@plane/ui";

// fixed, varied title widths so the skeleton looks organic without random values per render
const ROW_TITLE_WIDTHS = [310, 270, 330, 250, 300, 280, 340, 260, 320, 290];

export function PageLoader() {
  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="border-b border-subtle px-3 py-3">
        <Loader className="relative flex items-center gap-2">
          <Loader.Item width="200px" height="30px" />
          <div className="relative ml-auto flex items-center gap-2">
            <Loader.Item width="100px" height="30px" />
            <Loader.Item width="100px" height="30px" />
          </div>
        </Loader>
      </div>
      <div>
        {ROW_TITLE_WIDTHS.map((titleWidth) => (
          <Loader key={titleWidth} className="relative flex items-center gap-2 border-b border-subtle p-3 py-4">
            <Loader.Item width={`${titleWidth}px`} height="22px" />
            <div className="relative ml-auto flex items-center gap-2">
              <Loader.Item width="60px" height="22px" />
              <Loader.Item width="22px" height="22px" />
              <Loader.Item width="22px" height="22px" />
              <Loader.Item width="22px" height="22px" />
            </div>
          </Loader>
        ))}
      </div>
    </div>
  );
}
