/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { StickySearch } from "@/components/stickies/modal/search";
import { StickyHeaderView } from "@/components/stickies/header-view";
import { useStickyOperations } from "@/components/stickies/sticky/use-operations";
import { useSticky } from "@/hooks/use-stickies";
export const WorkspaceStickyHeader = observer(function WorkspaceStickyHeader() {
  const { workspaceSlug } = useParams();
  const { creatingSticky, toggleShowNewSticky } = useSticky();
  const { stickyOperations } = useStickyOperations({ workspaceSlug: workspaceSlug?.toString() });
  return (
    <StickyHeaderView
      search={<StickySearch />}
      creatingSticky={creatingSticky}
      create={() => {
        toggleShowNewSticky(true);
        stickyOperations.create();
      }}
    />
  );
});
