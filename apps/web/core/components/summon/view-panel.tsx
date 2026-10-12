/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";

/**
 * The content a section tab or filter chip shows. It rises in child by child (`t-stagger`) whenever `value`
 * changes, like a page opening; `contents` lays the children out as if the wrapper were not there.
 */
export function ViewPanel(props: { value: string; children: ReactNode }) {
  return (
    <div key={props.value} className="t-stagger contents">
      {props.children}
    </div>
  );
}
