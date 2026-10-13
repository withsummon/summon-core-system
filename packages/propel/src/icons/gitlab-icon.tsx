/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { GithubIcon } from "./github-icon";
import type { ISvgIcons } from "./type";

// Currently renders the same mark as GithubIcon; kept as its own export for callers.
export function GitlabIcon(props: ISvgIcons) {
  return <GithubIcon {...props} />;
}
