/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useLocation, useNavigate } from "react-router";

/**
 * Keeps a page's selected tab in the URL hash (`#team`). Each switch is a history entry, so Back
 * returns to the previous tab, and a reload or shared link reopens the same tab.
 * The first tab is the default and clears the hash.
 */
export function useHashTab<T extends string>(tabs: readonly T[]) {
  const location = useLocation();
  const navigate = useNavigate();
  const requested = location.hash.slice(1);
  const tab = tabs.find((item) => item === requested) ?? tabs[0];

  const selectTab = (next: T) => {
    if (next === tab) return;
    navigate({ search: location.search, hash: next === tabs[0] ? "" : next }, { preventScrollReset: true });
  };

  return [tab, selectTab] as const;
}
