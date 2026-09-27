/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useSticky } from "@/hooks/use-stickies";
import { StickySearchView } from "./search-view";
export const StickySearch = observer(function StickySearch() {
  const { workspaceSlug } = useParams();
  const { searchQuery, updateSearchQuery, fetchWorkspaceStickies } = useSticky();
  const [changed, setChanged] = useState(0);
  useEffect(() => {
    if (!changed) return;
    const timer = setTimeout(() => {
      void fetchWorkspaceStickies(workspaceSlug.toString());
    }, 500);
    return () => clearTimeout(timer);
  }, [changed, fetchWorkspaceStickies, workspaceSlug]);
  return (
    <StickySearchView
      searchQuery={searchQuery}
      updateSearchQuery={(value) => {
        updateSearchQuery(value);
        setChanged((number) => number + 1);
      }}
    />
  );
});
